const fs = require('fs-extra');
const path = require('path');
const { Client } = require('minecraft-launcher-core');
const { GAME_ROOT } = require('./constants');
const launcher = new Client();

async function launchGame(username, sender, auth = null, memory = '4G', logCallback = null) {
    // Load configuration from the manifest we just downloaded
    let manifest = {};
    try {
        manifest = await fs.readJson(path.join(GAME_ROOT, 'client-manifest.json'));
    } catch (e) {
        const msg = 'Warning: No manifest found. Using defaults.';
        sender.send('log', msg);
        if (logCallback) logCallback(msg);
    }

    // Default to 1.20.1 if not specified
    const gameVersion = manifest.gameVersion || '1.20.1';
    const versionType = manifest.versionType || 'release'; // 'release' or 'custom'
    const maxMemory = memory || manifest.maxMemory || '4G';
    const minMemory = manifest.minMemory || '2G';

    // Authorization (offline mode for now, or passed username)
    const token = {
        access_token: 'token',
        client_token: 'token',
        uuid: 'uuid',
        name: username,
        user_properties: '{}',
        meta: {
            type: 'mojang',
            demo: false
        }
    };

    // Ensure Java 21 is available
    const JavaManager = require('./JavaManager');
    const javaManager = new JavaManager(sender);
    let javaPath;

    try {
        sender.send('status', 'Verificando Java');
        javaPath = await javaManager.ensureJava();
    } catch (e) {
        const msg = `Error preparando Java: ${e.message}`;
        sender.send('error', msg);
        if (logCallback) logCallback(msg);
        throw e; // Stop launch
    }

    const opts = {
        clientPackage: null,
        authorization: auth || Promise.resolve(token),
        root: GAME_ROOT,
        javaPath: javaPath,
        version: {
            number: gameVersion,
            type: versionType
        },
        memory: {
            max: maxMemory,
            min: minMemory
        },
        overrides: {
            detached: false,
            checkFiles: true,
            checkHash: true
        }
    };

    // Verify the file exists in the standard location, but DO NOT pass 'custom' path to opts.
    // MCLC should find it automatically at versions/{number}/{number}.json
    if (versionType === 'custom') {
        const standardPath = path.join(GAME_ROOT, 'versions', gameVersion, `${gameVersion}.json`);
        const msg1 = `Buscando JSON personalizado en ruta estándar: ${standardPath}`;
        sender.send('log', msg1);
        if (logCallback) logCallback(msg1);

        if (fs.existsSync(standardPath)) {
            const msg2 = 'Archivo existe: true. Dejando que MCLC lo encuentre automáticamente.';
            sender.send('log', msg2);
            if (logCallback) logCallback(msg2);
            // We do NOT set opts.version.custom here.
        } else {
            const msg3 = `ADVERTENCIA: Archivo JSON personalizado NO encontrado en: ${standardPath}`;
            sender.send('log', msg3);
            if (logCallback) logCallback(msg3);
        }
    }

    // Helper to safely send IPC messages and log to console
    const safeLog = (msg) => {
        if (!sender.isDestroyed()) {
            sender.send('log', msg);
        }
        if (logCallback) logCallback(msg);
    };

    const safeSend = (channel, ...args) => {
        if (!sender.isDestroyed()) {
            sender.send(channel, ...args);
        }
    };

    safeLog(`Lanzando Minecraft ${gameVersion} (${versionType})...`);
    safeLog(`Usando Java en: ${javaPath}`);
    safeLog(`Opciones de lanzamiento: ${JSON.stringify(opts, null, 2)}`);

    // Progress of game files downloading (assets, jar, etc.)
    launcher.on('progress', (e) => {
        safeSend('progress', { current: e.task, total: e.total, type: 'game-download' });
    });

    launcher.on('debug', (e) => {
        safeLog(`[MC Debug] ${e}`);
        fs.appendFileSync(path.join(GAME_ROOT, 'debug_log.txt'), e + '\n');
        if (e.includes('Launching with arguments')) {
            fs.writeFileSync(path.join(GAME_ROOT, 'launch_cmd.txt'), e);
        }
    });
    launcher.on('data', (e) => safeLog(`[MC Salida] ${e}`));
    launcher.on('error', (e) => {
        safeLog(`[MC Error] ${e}`);
        safeSend('launch-error', e.message);
    });
    launcher.on('close', (e) => {
        safeLog(`[MC Cerrado] ${e}`);
        safeSend('launch-close', e);
    });

    await fs.writeJson(path.join(GAME_ROOT, 'launch_args.json'), opts, { spaces: 4 });
    await launcher.launch(opts);
}

module.exports = { launchGame };
