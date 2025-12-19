/* eslint-env browser */
const { ipcRenderer, shell } = require('electron');
const path = require('path');

// Global State
let instances = [];
let selectedInstance = null;

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

// Instance UI Elements
const sidebar = document.getElementById('sidebar');
const instanceTitle = document.getElementById('instance-title');
const instanceDesc = document.getElementById('instance-desc');

function renderSidebar() {
    if (!sidebar) return;
    sidebar.innerHTML = '';
    instances.forEach(insta => {
        if (!insta.enabled) return;

        const iconDiv = document.createElement('div');
        iconDiv.className = `instance-icon ${selectedInstance && selectedInstance.id === insta.id ? 'active' : ''}`;
        iconDiv.title = insta.name;

        if (insta.icon) {
            const img = document.createElement('img');
            // Try to resolve path relative to project root
            img.src = path.isAbsolute(insta.icon) ? insta.icon : path.join(__dirname, '..', insta.icon);

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

// (Initialization moved to initInstances)

// Load saved username
const savedUsername = localStorage.getItem('savedUsername');
if (savedUsername && usernameInput) {
    usernameInput.value = savedUsername;
}

// Set Version dynamically
try {
    const packageJson = require('../package.json');
    const versionText = document.getElementById('version-text');
    if (versionText) versionText.textContent = `v${packageJson.version}`;
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

let loginMode = 'offline';

if (modeOfflineBtn) {
    modeOfflineBtn.addEventListener('click', () => {
        loginMode = 'offline';
        modeOfflineBtn.classList.add('active');
        if (modeMicrosoftBtn) modeMicrosoftBtn.classList.remove('active');
        if (offlineInputContainer) offlineInputContainer.classList.remove('hidden');
        if (microsoftInfo) microsoftInfo.classList.add('hidden');
        if (btnText) btnText.textContent = 'JUGAR';
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
initInstances();
