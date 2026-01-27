const { ipcRenderer, shell, webUtils } = require('electron');
const path = require('path');

// Global State
let instances = [];
let selectedInstance = null;
let currentMicrosoftAccount = null;
let skinProcessor = null;
let skinViewer = null;
let loginMode = 'offline'; // Moved to top to avoid ReferenceError
try {
    skinProcessor = new Skin2D();
} catch (e) {
    console.error('Skin2D could not be initialized:', e);
}

function initSkinViewer() {
    try {
        const canvas = document.getElementById('skin-viewer-canvas');
        if (!canvas) return;

        skinViewer = new skinview3d.SkinViewer({
            canvas: canvas,
            width: 260,
            height: 320,
            skin: 'assets/steve.png'
        });

        // Setup controls
        skinViewer.controls.enableRotate = true;
        skinViewer.controls.enableZoom = false; // Zoom can be annoying in a small modal
        skinViewer.background = null; // Transparent

        // Idle animation
        skinViewer.animations.add(skinview3d.IdleAnimation);

        console.log('SkinViewer 3D initialized');
    } catch (e) {
        console.error('Error initializing SkinViewer:', e);
    }
}

async function detectSkinModel(skinSource) {
    try {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                if (img.height === 64) {
                    // Check the pixel that differentiates Slim from Classic
                    const pixelData = ctx.getImageData(54, 20, 1, 1).data;
                    const isSlim = pixelData[3] === 0;
                    resolve(isSlim ? 'slim' : 'classic');
                } else {
                    resolve('classic');
                }
            };
            img.onerror = () => resolve('classic');
            img.src = skinSource;
        });
    } catch (e) {
        return 'classic';
    }
}

// Load Instances Asynchronously
async function initInstances() {
    try {
        instances = await ipcRenderer.invoke('get-instances');

        // Select first enabled instance by default
        selectedInstance = instances.find(i => i.enabled) || instances[0];

        // Initialize UI
        renderSidebar();
        updateInstanceUI();

        // Start updates immediately
        triggerUpdate(selectedInstance ? selectedInstance.id : 'default');
    } catch (e) {
        console.error('Error loading instances:', e);
        // Fallback or show error UI
        instances = [{
            id: 'default',
            name: 'Principal',
            icon: 'assets/icon_default.png',
            description: 'Instancia Principal',
            modsDir: 'mods',
            enabled: true,
            manifestUrl: 'https://raw.githubusercontent.com/Chomingo/Hoppercloud/master/manifest.json'
        }];
        selectedInstance = instances[0];
        renderSidebar();
        updateInstanceUI();
    }
}

const launchBtn = document.getElementById('launch-btn');
const usernameInput = document.getElementById('username');
const consoleOutput = document.getElementById('console-output');
const progressBar = document.getElementById('progress-bar');
const statusBadge = document.getElementById('status-badge');
const btnText = document.querySelector('.btn-text');
const playerHead = document.getElementById('player-head');

// Skin UI Elements
const uploadSkinBtn = document.getElementById('upload-skin-btn');
const skinFileInput = document.getElementById('skin-file-input');
const skinManagementSection = document.getElementById('skin-management-section');

// Instance UI Elements
const sidebar = document.getElementById('sidebar');
const instanceTitle = document.getElementById('instance-title');
const instanceDesc = document.getElementById('instance-desc');

function renderSidebar() {
    if (!sidebar) return;
    sidebar.innerHTML = '';
    instances.forEach((insta, index) => {
        if (!insta.enabled) return;

        const iconDiv = document.createElement('div');
        iconDiv.className = `instance-icon ${selectedInstance && selectedInstance.id === insta.id ? 'active' : ''}`;
        iconDiv.title = insta.name;

        // Try to resolve icon Path
        // 1. Explicitly set in manifest
        // 2. Default naming convention: assets/instancia1.png, assets/instancia2.png...
        // 3. Fallback to generic icon or first letter
        const fs = require('fs-extra');
        let iconPath = insta.icon ? (path.isAbsolute(insta.icon) ? insta.icon : path.join(__dirname, '..', insta.icon)) : null;

        // Fallback to convention if missing
        if (!iconPath || !fs.existsSync(iconPath)) {
            const conventionPath = path.join(__dirname, '..', 'assets', `instancia${index + 1}.png`);
            if (fs.existsSync(conventionPath)) {
                iconPath = conventionPath;
            }
        }

        if (iconPath && fs.existsSync(iconPath)) {
            const img = document.createElement('img');
            img.src = iconPath;
            img.onerror = () => {
                img.style.display = 'none';
                iconDiv.textContent = insta.name.charAt(0).toUpperCase();
            };
            iconDiv.appendChild(img);
        } else {
            iconDiv.textContent = insta.name.charAt(0).toUpperCase();
        }

        iconDiv.addEventListener('click', () => {
            selectInstance(insta);
        });

        sidebar.appendChild(iconDiv);
    });
}

function selectInstance(inst) {
    selectedInstance = inst;
    renderSidebar();
    updateInstanceUI();

    // Check updates for this instance
    triggerUpdate(inst.id);
}

function updateInstanceUI() {
    if (selectedInstance && instanceTitle && instanceDesc) {
        instanceTitle.textContent = selectedInstance.name;
        instanceDesc.textContent = selectedInstance.description || 'Launcher de Hopper Studios';
    }
}

function triggerUpdate(instanceId) {
    if (!launchBtn || !btnText || !statusBadge || !progressBar) return;

    launchBtn.disabled = true;
    btnText.textContent = 'ACTUALIZANDO...';
    statusBadge.textContent = 'Buscando Actualizaciones';

    // Reset Progress
    progressBar.style.width = '0%';

    ipcRenderer.send('check-updates', { instanceId });
}

const headerUsername = document.getElementById('header-username');

function updateHeaderTitle(name) {
    if (headerUsername) {
        headerUsername.textContent = name && name.trim().length > 0 ? name : 'Crystal Launcher';
    }
}

// Load saved username
const savedUsername = localStorage.getItem('savedUsername');
if (savedUsername && usernameInput) {
    usernameInput.value = savedUsername;
    updatePlayerHead(savedUsername);
    updateHeaderTitle(savedUsername);
}

// Initial UI state for skins
try {
    if (loginMode === 'offline' && skinManagementSection) {
        skinManagementSection.classList.remove('hidden');
    }
} catch (e) {
    console.error('Error setting initial UI state:', e);
}

// Watch username changes
if (usernameInput) {
    usernameInput.addEventListener('input', () => {
        if (loginMode === 'offline') {
            updatePlayerHead(usernameInput.value);
            updateHeaderTitle(usernameInput.value);
        }
    });
}

async function updatePlayerHead(usernameOrSkin, manualSkinSource = null) {
    if (!playerHead) return;
    try {
        let skinSource = manualSkinSource;

        if (!skinSource) {
            if (loginMode === 'offline') {
                if (!usernameOrSkin) {
                    playerHead.style.backgroundImage = "url('assets/steve.png')";
                    return;
                }

                // Sync with utils/constants.js
                const appData = process.env.APPDATA || (process.platform === 'darwin' ? path.join(process.env.HOME, 'Library', 'Application Support') : path.join(process.env.HOME, '.local', 'share'));
                const gameRoot = process.env.OMBICRAFT_GAME_ROOT || path.join(appData, '.minecraft_server_josh');
                const localSkinPath = path.join(gameRoot, 'skins', `${usernameOrSkin}.png`);

                const fs = require('fs-extra');
                if (await fs.pathExists(localSkinPath)) {
                    // Use base64 for local files to avoid file:// protocol issues/caching
                    const buffer = await fs.readFile(localSkinPath);
                    skinSource = `data:image/png;base64,${buffer.toString('base64')}`;
                } else {
                    // Use mineskin.eu as fallback for offline
                    skinSource = `https://mineskin.eu/skin/${usernameOrSkin}`;
                }
            } else {
                // For Microsoft, use mineskin as placeholder/fallback
                skinSource = `https://mineskin.eu/skin/${usernameOrSkin}`;
            }
        }

        if (skinProcessor) {
            try {
                // Extract face using Skin2D
                const headDataUrl = await skinProcessor.getHead(skinSource);
                playerHead.style.backgroundImage = `url('${headDataUrl}')`;
            } catch (err) {
                console.warn('SkinProcessor failed, falling back to raw helm API:', err);
                playerHead.style.backgroundImage = `url('https://mineskin.eu/helm/${usernameOrSkin}')`;
            }
        } else {
            playerHead.style.backgroundImage = `url('https://mineskin.eu/helm/${usernameOrSkin}')`;
        }

        // Update 3D Viewer if available
        if (skinViewer && skinSource) {
            skinViewer.loadSkin(skinSource);

            // Auto-detect model
            detectSkinModel(skinSource).then(model => {
                if (skinViewer) skinViewer.model = model;
                const label = document.getElementById('skin-model-name');
                if (label) label.textContent = model.charAt(0).toUpperCase() + model.slice(1);
            });
        }
    } catch (e) {
        console.error('Error updating player head:', e);
        playerHead.style.backgroundImage = "url('assets/steve.png')";
    }
}

// Set Version dynamically
try {
    const packageJson = require('../package.json');
    const versionText = document.getElementById('version-text');
    if (versionText) versionText.textContent = `v${packageJson.version}`;

    // Update Dashboard Info Card Version
    const versionHighlight = document.querySelector('.version-highlight');
    if (versionHighlight) versionHighlight.textContent = packageJson.version;
} catch (e) {
    console.error('Error loading version:', e);
}

// Settings Logic
const settingsBtn = document.getElementById('settings-btn');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const settingsOverlay = document.getElementById('settings-overlay');
const ramSlider = document.getElementById('ram-slider');
const ramValue = document.getElementById('ram-value');

// Load saved RAM
const savedRam = localStorage.getItem('savedRam') || '4';
if (ramSlider && ramValue) {
    ramSlider.value = savedRam;
    ramValue.textContent = `${savedRam} GB`;
}

if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
        if (settingsOverlay) settingsOverlay.classList.remove('hidden');
    });
}

if (closeSettingsBtn) {
    closeSettingsBtn.addEventListener('click', () => {
        if (settingsOverlay) settingsOverlay.classList.add('hidden');
    });
}

if (ramSlider) {
    ramSlider.addEventListener('input', (e) => {
        const val = e.target.value;
        if (ramValue) ramValue.textContent = `${val} GB`;
        localStorage.setItem('savedRam', val);
    });
}

if (settingsOverlay) {
    settingsOverlay.addEventListener('click', (e) => {
        if (e.target === settingsOverlay) {
            settingsOverlay.classList.add('hidden');
        }
    });
}

function log(message) {
    if (!consoleOutput) return;
    const p = document.createElement('p');
    p.className = 'log-line';
    p.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    consoleOutput.appendChild(p);
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

const copyLogsBtn = document.getElementById('copy-logs-btn');
if (copyLogsBtn) {
    copyLogsBtn.addEventListener('click', () => {
        const logs = consoleOutput ? consoleOutput.innerText : '';
        navigator.clipboard.writeText(logs).then(() => {
            const originalText = copyLogsBtn.textContent;
            copyLogsBtn.textContent = '¡Copiado!';
            setTimeout(() => { copyLogsBtn.textContent = originalText; }, 2000);
        }).catch(err => {
            console.error('Error al copiar logs:', err);
        });
    });
}

const toggleConsoleBtn = document.getElementById('toggle-console-btn');
const consoleContainer = document.getElementById('console-container');
const closeConsoleBtn = document.getElementById('close-console-btn');

if (toggleConsoleBtn) {
    toggleConsoleBtn.addEventListener('click', () => {
        if (consoleContainer) consoleContainer.classList.toggle('visible');
    });
}

if (closeConsoleBtn) {
    closeConsoleBtn.addEventListener('click', () => {
        if (consoleContainer) consoleContainer.classList.remove('visible');
    });
}

document.addEventListener('click', (e) => {
    if (consoleContainer && consoleContainer.classList.contains('visible') &&
        !consoleContainer.contains(e.target) &&
        toggleConsoleBtn && !toggleConsoleBtn.contains(e.target)) {
        consoleContainer.classList.remove('visible');
    }
});

const modeOfflineBtn = document.getElementById('mode-offline');
const modeMicrosoftBtn = document.getElementById('mode-microsoft');
const offlineInputContainer = document.getElementById('offline-input-container');
const microsoftInfo = document.getElementById('microsoft-info');

if (modeOfflineBtn) {
    modeOfflineBtn.addEventListener('click', () => {
        loginMode = 'offline';
        modeOfflineBtn.classList.add('active');
        if (modeMicrosoftBtn) modeMicrosoftBtn.classList.remove('active');
        if (offlineInputContainer) offlineInputContainer.classList.remove('hidden');
        if (microsoftInfo) microsoftInfo.classList.add('hidden');
        if (btnText) btnText.textContent = 'JUGAR';

        // Update head for offline user
        const currentName = usernameInput ? usernameInput.value : '';
        updatePlayerHead(currentName);
        updateHeaderTitle(currentName);

        // Show skin management even in offline mode
        if (skinManagementSection) skinManagementSection.classList.remove('hidden');
    });
}

if (modeMicrosoftBtn) {
    modeMicrosoftBtn.addEventListener('click', () => {
        loginMode = 'microsoft';
        modeMicrosoftBtn.classList.add('active');
        if (modeOfflineBtn) modeOfflineBtn.classList.remove('active');
        if (offlineInputContainer) offlineInputContainer.classList.add('hidden');
        if (microsoftInfo) microsoftInfo.classList.remove('hidden');
        if (btnText) btnText.textContent = 'INICIAR SESIÓN Y JUGAR';

        if (currentMicrosoftAccount) {
            // Use official skin if available
            const skinBase64 = currentMicrosoftAccount.profile?.skins?.[0]?.base64;
            updatePlayerHead(currentMicrosoftAccount.name, skinBase64 ? `data:image/png;base64,${skinBase64}` : null);

            // Hide skin management for premium (as requested: "solo para no premiums")
            if (skinManagementSection) skinManagementSection.classList.add('hidden');
        } else {
            playerHead.style.backgroundImage = "url('assets/steve.png')";
            if (skinManagementSection) skinManagementSection.classList.add('hidden');
        }
    });
}

// Skin Upload Logic
if (uploadSkinBtn && skinFileInput) {
    uploadSkinBtn.addEventListener('click', () => {
        skinFileInput.click();
    });

    skinFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const username = usernameInput ? usernameInput.value : '';
        if (loginMode === 'offline' && !username) {
            log('Error: Debes ingresar un nombre de usuario para asignar la skin.');
            return;
        }

        if (loginMode === 'microsoft' && !currentMicrosoftAccount) {
            log('Error: Debes iniciar sesión con Microsoft para cambiar tu skin oficial.');
            return;
        }

        log(loginMode === 'microsoft' ? `Subiendo skin a Mojang: ${file.name}...` : `Guardando skin local: ${file.name}...`);

        // In newer Electron (like v39), file.path is often disabled.
        // We use webUtils.getPathForFile if available.
        const filePath = webUtils ? webUtils.getPathForFile(file) : file.path;

        if (!filePath) {
            log('Error: No se pudo obtener la ruta del archivo. Intenta ejecutar como administrador o verifica los permisos.');
            uploadSkinBtn.disabled = false;
            uploadSkinBtn.textContent = '📤 Cambiar Skin (.png)';
            return;
        }

        uploadSkinBtn.disabled = true;
        uploadSkinBtn.textContent = '⌛ Subiendo...';

        try {
            const result = await ipcRenderer.invoke('upload-skin', {
                filePath: filePath,
                accessToken: loginMode === 'microsoft' ? currentMicrosoftAccount.accessToken : null,
                username: username
            });

            if (result.success) {
                log(result.mode === 'microsoft' ? '✅ Skin actualizada en Mojang correctamente.' : '✅ Skin local guardada correctamente.');
                // Refresh head
                const nameToRefresh = loginMode === 'microsoft' ? currentMicrosoftAccount.name : username;
                setTimeout(() => updatePlayerHead(nameToRefresh), result.mode === 'microsoft' ? 3000 : 500);
            } else {
                log(`❌ Error al subir skin: ${result.error}`);
            }
        } catch (err) {
            log(`❌ Error crítico al subir skin: ${err.message}`);
        } finally {
            uploadSkinBtn.disabled = false;
            uploadSkinBtn.textContent = '📤 Cambiar Skin (.png)';
            skinFileInput.value = '';
        }
    });
}

if (launchBtn) {
    launchBtn.addEventListener('click', () => {
        const username = usernameInput ? usernameInput.value : '';

        if (loginMode === 'offline' && !username) {
            log('Error: El nombre de usuario es obligatorio.');
            return;
        }

        if (loginMode === 'offline') {
            localStorage.setItem('savedUsername', username);
        }

        launchBtn.disabled = true;
        if (btnText) btnText.textContent = loginMode === 'microsoft' ? 'INICIANDO SESIÓN...' : 'INICIANDO...';

        const memory = localStorage.getItem('savedRam') || '4';
        const instanceId = selectedInstance ? selectedInstance.id : 'default';

        ipcRenderer.send('launch-game', { username, mode: loginMode, memory: `${memory}G`, instanceId });
    });
}

ipcRenderer.on('log', (event, message) => {
    log(message);
});

ipcRenderer.on('progress', (event, { current, total, type }) => {
    if (progressBar) {
        const percentage = Math.min(100, Math.max(0, (current / total) * 100));
        progressBar.style.width = `${percentage}%`;
    }
});

ipcRenderer.on('status', (event, status) => {
    if (statusBadge) statusBadge.textContent = status;
    if (status === 'Listo') {
        if (launchBtn) launchBtn.disabled = false;
        if (btnText) btnText.textContent = 'JUGAR';
        if (progressBar) progressBar.style.width = '0%';
    } else if (status === 'Jugando') {
        if (btnText) btnText.textContent = 'JUGANDO';
    }
});

const retryBtn = document.getElementById('retry-btn');
if (retryBtn) {
    retryBtn.addEventListener('click', () => {
        retryBtn.classList.add('hidden');
        if (launchBtn) {
            launchBtn.classList.remove('hidden');
            launchBtn.disabled = true;
        }
        if (btnText) btnText.textContent = 'ACTUALIZANDO...';
        if (statusBadge) statusBadge.textContent = 'Actualizando';
        log('Reintentando actualización...');
        ipcRenderer.send('check-updates', { instanceId: selectedInstance ? selectedInstance.id : 'default' });
    });
}

ipcRenderer.on('auth-success', (event, account) => {
    currentMicrosoftAccount = account;
    if (loginMode === 'microsoft') {
        const skinBase64 = account.profile?.skins?.[0]?.base64;
        updatePlayerHead(account.name, skinBase64 ? `data:image/png;base64,${skinBase64}` : null);
        updateHeaderTitle(account.name);

        // Ensure section is hidden for premium
        if (skinManagementSection) skinManagementSection.classList.add('hidden');
    }
});

ipcRenderer.on('error', (event, error) => {
    log(`Error: ${error}`);
    if (statusBadge) statusBadge.textContent = 'Error';
    if (launchBtn) {
        launchBtn.disabled = false;
        btnText.textContent = 'JUGAR';
    }
    if (progressBar) progressBar.style.width = '0%';

    if (error.includes('Actualización fallida') || error.includes('Manifiesto')) {
        if (launchBtn) launchBtn.classList.add('hidden');
        if (retryBtn) retryBtn.classList.remove('hidden');
    }
});

ipcRenderer.on('launch-close', (event) => {
    log('Juego cerrado.');
    if (statusBadge) statusBadge.textContent = 'Listo';
    if (launchBtn) launchBtn.disabled = false;
    if (btnText) btnText.textContent = 'JUGAR';
    if (progressBar) progressBar.style.width = '0%';
});

ipcRenderer.on('update-complete', () => {
    if (launchBtn) {
        launchBtn.disabled = false;
        launchBtn.classList.remove('hidden');
    }
    if (btnText) btnText.textContent = 'JUGAR';
    if (retryBtn) retryBtn.classList.add('hidden');
});

ipcRenderer.on('launcher-update-available', (event, version) => {
    const updateBtn = document.getElementById('update-launcher-btn');
    if (updateBtn) {
        const btnSpan = updateBtn.querySelector('span');
        updateBtn.classList.remove('hidden');
        if (btnSpan) btnSpan.textContent = `⚡ Nueva versión v${version} disponible (Clic para descargar)`;

        const newBtn = updateBtn.cloneNode(true);
        updateBtn.parentNode.replaceChild(newBtn, updateBtn);

        newBtn.addEventListener('click', () => {
            const span = newBtn.querySelector('span');
            if (span) span.textContent = '⬇️ Iniciando descarga...';
            ipcRenderer.send('start-launcher-update');
        });
    }
    log('Nueva versión detectada. Esperando confirmación del usuario...');
});

ipcRenderer.on('launcher-update-not-available', () => {
    const updateBtn = document.getElementById('update-launcher-btn');
    if (updateBtn) updateBtn.classList.add('hidden');
});

ipcRenderer.on('launcher-download-progress', (event, percent) => {
    const updateBtn = document.getElementById('update-launcher-btn');
    if (updateBtn) {
        const btnSpan = updateBtn.querySelector('span');
        if (btnSpan) btnSpan.textContent = `⬇️ Descargando: ${Math.round(percent)}%`;
    }
});

ipcRenderer.on('launcher-update-ready', () => {
    const updateBtn = document.getElementById('update-launcher-btn');
    if (updateBtn) {
        const btnSpan = updateBtn.querySelector('span');
        updateBtn.classList.remove('hidden');
        if (btnSpan) btnSpan.textContent = '🚀 Reiniciar y Actualizar Launcher';
        updateBtn.onclick = () => {
            ipcRenderer.send('install-launcher-update');
        };
    }
    log('Actualización del launcher lista. Haz clic en el botón para reiniciar.');
});

// Start initialization
initInstances().catch(e => {
    console.error('Critical error during initialization:', e);
    log('Error crítico al iniciar el launcher.');
});
if (typeof skinview3d !== 'undefined') {
    initSkinViewer();
}

// Quick Cleanup Logic
const cleanupBtn = document.getElementById('cleanup-btn');
const cleanupStatus = document.getElementById('cleanup-status');

if (cleanupBtn) {
    cleanupBtn.addEventListener('click', async () => {
        cleanupBtn.disabled = true;
        cleanupBtn.style.opacity = '0.7';
        cleanupStatus.textContent = 'Limpiando archivos basura...';
        cleanupStatus.style.color = 'var(--accent)';

        try {
            const result = await ipcRenderer.invoke('trigger-cleanup');
            if (result.success) {
                cleanupStatus.textContent = `¡Limpieza exitosa! Se liberaron ${result.spaceFreedMB} MB.`;
                cleanupStatus.style.color = '#4CAF50';
            } else {
                cleanupStatus.textContent = `Error: ${result.error}`;
                cleanupStatus.style.color = '#f44336';
            }
        } catch (error) {
            cleanupStatus.textContent = 'Error al ejecutar la limpieza.';
            cleanupStatus.style.color = '#f44336';
        }


        setTimeout(() => {
            cleanupBtn.disabled = false;
            cleanupBtn.style.opacity = '1';
        }, 3000);
    });
}

// Initial Background Initialization
(async () => {
    try {
        const fs = require('fs-extra');
        const customFondoLocal = path.join(__dirname, '..', 'assets', 'fondo.png');
        const savedBg = localStorage.getItem('customBackground');

        if (fs.existsSync(customFondoLocal)) {
            // Priority 1: assets/fondo.png (Admin set)
            const bgUrl = `file://${customFondoLocal.replace(/\\/g, '/')}`;
            document.body.style.backgroundImage = `url('${bgUrl}')`;
            document.body.style.backgroundSize = 'cover';
            document.body.style.backgroundPosition = 'center';
        } else if (savedBg && savedBg !== 'default') {
            // Priority 2: Leftover legacy backgrounds (if any)
            document.body.style.backgroundImage = `url('${savedBg.replace(/\\/g, '/')}')`;
            document.body.style.backgroundSize = 'cover';
            document.body.style.backgroundPosition = 'center';
        }
    } catch (e) {
        console.error('Error loading background:', e);
    }
})();

