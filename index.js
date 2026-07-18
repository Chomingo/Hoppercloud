const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const { GAME_ROOT } = require('./utils/constants');
const { autoUpdater } = require('electron-updater');

// Parse command line arguments
const args = process.argv.slice(1);
const gameDirArgIndex = args.indexOf('--game-dir');
if (gameDirArgIndex !== -1 && args[gameDirArgIndex + 1]) {
    process.env.OMBICRAFT_GAME_ROOT = args[gameDirArgIndex + 1];
    console.log(`Custom game directory set to: ${process.env.OMBICRAFT_GAME_ROOT}`);
}

// Configure autoUpdater
autoUpdater.autoDownload = false;
const { log, consoleLog, clearLogs } = require('./utils/logger');
const discord = require('./utils/discord');

let lastLogTime = 0;
function logToConsole(message, type = 'info') {
    const isSpammy = message.includes('Descargando') || message.includes('Verificando') || message.includes('Eliminando') || message.includes('Actualizando');
    const now = Date.now();

    if (mainWindow && !mainWindow.isDestroyed()) {
        // Throttling para logs de actualización masiva
        if (!isSpammy || (now - lastLogTime > 150) || type === 'error') {
            mainWindow.webContents.send('log', message);
            if (isSpammy) lastLogTime = now;
        }
    }

    if (type === 'error') {
        consoleLog.error(message);
    } else if (type === 'warn') {
        consoleLog.warn(message);
    } else {
        consoleLog.info(message);
    }
}
autoUpdater.logger = log;

// ... (existing code) ...

ipcMain.on('start-launcher-update', () => {
    logToConsole('Iniciando descarga de actualización...');
    autoUpdater.downloadUpdate();
});

// Ensure we start with a fresh log file each time
clearLogs();

// In development, write logs to project directory for easier access
if (!app.isPackaged) {
    // Already handled in logger.js default config, but we can override if needed
    // log.transports.file.resolvePathFn = ...
}

const GameUpdater = require('./utils/GameUpdater');
const { launchGame } = require('./utils/launcher');
const { loginMicrosoft } = require('./utils/auth');
const { importSettings } = require('./utils/importer');

let mainWindow;

// Initialize GameUpdater
const gameUpdater = new GameUpdater();

// Global state tracking
let isGameRunning = false;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 900,
        height: 750,
        minWidth: 800,
        minHeight: 600,
        frame: true,
        transparent: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        backgroundColor: '#121212',
        resizable: true,
        icon: path.join(__dirname, 'assets', 'logo.png')
    });

    mainWindow.loadFile(path.join(__dirname, 'ui', 'index.html'));
    mainWindow.removeMenu();

    mainWindow.once('ready-to-show', async () => {
        // AutoUpdater now defaults to stable/master unless user overrides via config
        autoUpdater.allowPrerelease = false;
        log.info('Iniciando AutoUpdater...');
        autoUpdater.checkForUpdates();
    });
}

app.whenReady().then(() => {
    discord.init();
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// Instances & Remote Config
const INSTANCES_CACHE_PATH = path.join(GAME_ROOT, 'launcher_instances.json');
const REMOTE_INSTANCES_URL = 'https://raw.githubusercontent.com/Chomingo/Hoppercloud/master/remote_instances.json';

let instances = [];

async function loadInstances() {
    try {
        // 1. Try to fetch from remote
        log.info('Cargando perfiles desde GitHub...');
        const axios = require('axios');
        const response = await axios.get(`${REMOTE_INSTANCES_URL}?t=${Date.now()}`, {
            timeout: 5000 // 5 second timeout
        });
        instances = response.data;

        // Save to cache
        await fs.writeJson(INSTANCES_CACHE_PATH, instances);
        log.info('Perfiles actualizados y guardados en caché.');
    } catch (error) {
        log.error(`Error cargando perfiles remotos: ${error.message}`);

        // 2. Fallback to cache
        if (await fs.pathExists(INSTANCES_CACHE_PATH)) {
            log.info('Usando perfiles guardados en caché local.');
            instances = await fs.readJson(INSTANCES_CACHE_PATH);
        } else {
            // 3. Fallback to hardcoded defaults (utils/instances.js)
            log.info('Usando perfiles predeterminados.');
            try {
                instances = require('./utils/instances');
            } catch (e) {
                instances = [{
                    id: 'default',
                    name: 'Principal',
                    icon: 'assets/icon_default.png',
                    description: 'Instancia Principal',
                    modsDir: 'mods',
                    enabled: true,
                    manifestUrl: 'https://raw.githubusercontent.com/Chomingo/Hoppercloud/master/manifest.json'
                }];
            }
        }
    }
    return instances;
}

// IPC Handlers
ipcMain.handle('trigger-cleanup', async () => {
    const { cleanupGameFiles } = require('./utils/cleanup');
    return await cleanupGameFiles();
});

ipcMain.handle('get-instances', async () => {
    if (instances.length === 0) {
        return await loadInstances();
    }
    return instances;
});

ipcMain.handle('upload-skin', async (event, { filePath, accessToken, username }) => {
    const axios = require('axios');
    const FormData = require('form-data');
    const fs = require('fs-extra');

    try {
        if (accessToken) {
            // Microsoft Account - Upload to Mojang
            const form = new FormData();
            form.append('variant', 'classic');
            form.append('file', fs.createReadStream(filePath));

            const response = await axios.post('https://api.minecraftservices.com/minecraft/profile/skins', form, {
                headers: {
                    ...form.getHeaders(),
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            if (response.status === 200 || response.status === 204) {
                return { success: true, mode: 'microsoft' };
            } else {
                return { success: false, error: `API returned status ${response.status}` };
            }
        } else {
            // Offline Account - Save locally
            if (!username) return { success: false, error: 'Nombre de usuario no proporcionado' };

            // 1. Save to Launcher Cache (for UI)
            const launcherSkinsDir = path.join(GAME_ROOT, 'skins');
            await fs.ensureDir(launcherSkinsDir);
            const launcherDest = path.join(launcherSkinsDir, `${username}.png`);
            await fs.copy(filePath, launcherDest);

            // 2. Save to CustomSkinLoader path (for in-game visibility if mod is present)
            // We save it to the global root as many mods look there or we can sync it.
            const cslDir = path.join(GAME_ROOT, 'CustomSkinLoader', 'LocalSkin', 'skins');
            await fs.ensureDir(cslDir);
            await fs.copy(filePath, path.join(cslDir, `${username}.png`));

            log.info(`Skin local guardada para ${username} en cache y CustomSkinLoader.`);
            return { success: true, mode: 'offline', path: launcherDest };
        }
    } catch (error) {
        log.error(`Skin upload error: ${error.message}`);
        return { success: false, error: error.response?.data?.errorMessage || error.message };
    }
});

ipcMain.on('check-updates', async (event, { instanceId } = {}) => {
    const sender = event.sender;

    if (isGameRunning) {
        sender.send('error', 'No se puede actualizar mientras el juego está en ejecución.');
        sender.send('log', 'ADVERTENCIA: Intento de actualización abortado porque el juego está abierto.');
        return;
    }

    // Setup listeners for this update session
    const onLog = (msg) => logToConsole(msg, 'info');
    const onProgress = (data) => sender.send('progress', data);
    const onError = (msg) => logToConsole(msg, 'error');

    gameUpdater.on('log', onLog);
    gameUpdater.on('progress', onProgress);
    gameUpdater.on('error', onError);

    try {
        sender.send('status', 'Buscando Actualizaciones');

        // Ensure instances are loaded
        if (instances.length === 0) await loadInstances();

        // Resolve Instance
        const selectedInstance = instances.find(i => i.id === instanceId) || instances[0];

        // Resolve Manifest URL: Use direct URL if available, otherwise construct it or default to master
        let manifestUrl = selectedInstance.manifestUrl;
        if (!manifestUrl) {
            const branch = selectedInstance.branch || 'master';
            manifestUrl = `https://raw.githubusercontent.com/Chomingo/Hoppercloud/${branch}/manifest.json`;
        }

        // Determine Target Directory
        let gameDirectory = GAME_ROOT;
        if (selectedInstance.gameDir) {
            if (path.isAbsolute(selectedInstance.gameDir)) {
                gameDirectory = selectedInstance.gameDir;
            } else {
                gameDirectory = path.join(GAME_ROOT, selectedInstance.gameDir);
            }
        } else if (selectedInstance.id !== 'default') {
            gameDirectory = path.join(GAME_ROOT, 'instances', selectedInstance.id);
        }

        // Usamos el método log del updater para que respete el filtrado de privacidad
        gameUpdater.log(`Verificando actualizaciones para: ${selectedInstance.name} en ${manifestUrl}`);

        // Check and Download
        await gameUpdater.checkAndDownloadUpdates(gameDirectory, manifestUrl);

        sender.send('update-complete');
        sender.send('status', 'Listo');
    } catch (error) {
        console.error(error);
        sender.send('error', error.message);
    } finally {
        // Cleanup listeners to avoid memory leaks or duplicate events
        gameUpdater.off('log', onLog);
        gameUpdater.off('progress', onProgress);
        gameUpdater.off('error', onError);
    }
});

ipcMain.on('launch-game', async (event, { username, mode, memory, instanceId }) => {
    const sender = event.sender;

    // Helper for logging
    const logLocal = (msg, type = 'info') => logToConsole(msg, type);

    try {
        let auth = null;

        if (mode === 'microsoft') {
            sender.send('status', 'Iniciando Sesión');
            logLocal('Iniciando sesión con Microsoft...');
            auth = await loginMicrosoft(sender);
            logLocal(`Sesión iniciada como: ${auth.name}`);

            // Send account info back for skin display
            sender.send('auth-success', {
                name: auth.name,
                uuid: auth.uuid,
                accessToken: auth.access_token // We'll update auth.js to include this
            });
        }

        sender.send('status', 'Iniciando');
        logLocal('Iniciando juego...');

        isGameRunning = true;
        const selectedInstance = instances.find(i => i.id === instanceId) || instances[0];
        discord.setPlayingStatus(selectedInstance.name);

        await launchGame(username, sender, auth, memory, (msg) => logToConsole(msg), instanceId, instances);

        sender.send('status', 'Jugando');
    } catch (error) {
        console.error(error);
        isGameRunning = false;
        sender.send('error', error.message);
        consoleLog.error(error.message);
    }
});

ipcMain.on('launch-close', () => {
    isGameRunning = false;
    discord.setMenuStatus();
});

ipcMain.on('launch-error', () => {
    isGameRunning = false;
});

// (Moved to top)

ipcMain.on('open-mods-folder', async (event, relativePath) => {
    try {
        let folderPath;
        if (path.isAbsolute(relativePath)) {
            folderPath = relativePath;
        } else {
            folderPath = path.join(GAME_ROOT, relativePath);
        }

        await fs.ensureDir(folderPath); // Create if it doesn't exist
        await shell.openPath(folderPath);
    } catch (e) {
        console.error('Failed to open mods folder:', e);
    }
});


// AutoUpdater Events
autoUpdater.on('checking-for-update', () => {
    if (mainWindow) mainWindow.webContents.send('log', 'Buscando actualizaciones del launcher...');
});

autoUpdater.on('update-available', (info) => {
    if (mainWindow) {
        mainWindow.webContents.send('log', `Actualización disponible: v${info.version}`);
        mainWindow.webContents.send('launcher-update-available', info.version);
    }
});

autoUpdater.on('update-not-available', () => {
    if (mainWindow) {
        mainWindow.webContents.send('log', 'El launcher está actualizado.');
        mainWindow.webContents.send('launcher-update-not-available');
    }
});

autoUpdater.on('error', (err) => {
    if (mainWindow) mainWindow.webContents.send('log', `Error en auto-update: ${err}`);
});

autoUpdater.on('download-progress', (progressObj) => {
    if (mainWindow) {
        mainWindow.webContents.send('launcher-download-progress', progressObj.percent);
    }
});

autoUpdater.on('update-downloaded', () => {
    if (mainWindow) {
        mainWindow.webContents.send('log', 'Actualización descargada. Lista para instalar.');
        mainWindow.webContents.send('launcher-update-ready');
    }
});

ipcMain.on('install-launcher-update', () => {
    autoUpdater.quitAndInstall();
});
