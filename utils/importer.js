const { dialog, BrowserWindow } = require('electron');
const fs = require('fs-extra');
const path = require('path');

// Standard TLauncher/Minecraft path
const TLAUNCHER_ROOT = path.join(process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME + '/.local/share'), '.minecraft');

async function findSourceRoot() {
    const candidates = [];

    // 1. Check root .minecraft
    if (await fs.pathExists(path.join(TLAUNCHER_ROOT, 'options.txt'))) {
        candidates.push(TLAUNCHER_ROOT);
    }

    // 2. Check versions folder (TLauncher modpacks often live here)
    const versionsDir = path.join(TLAUNCHER_ROOT, 'versions');
    if (await fs.pathExists(versionsDir)) {
        const entries = await fs.readdir(versionsDir);
        for (const entry of entries) {
            const fullPath = path.join(versionsDir, entry);
            // Check if it's a directory and has options.txt (indicates a separate instance)
            if ((await fs.stat(fullPath)).isDirectory() && await fs.pathExists(path.join(fullPath, 'options.txt'))) {
                candidates.push(fullPath);
            }
        }
    }

    if (candidates.length === 0) return null;

    // 3. Find the most recently modified options.txt
    let bestCandidate = null;
    let maxTime = 0;

    for (const candidate of candidates) {
        try {
            const stats = await fs.stat(path.join(candidate, 'options.txt'));
            if (stats.mtimeMs > maxTime) {
                maxTime = stats.mtimeMs;
                bestCandidate = candidate;
            }
        } catch (e) {
            console.error(`Error checking candidate ${candidate}:`, e);
        }
    }

    return bestCandidate;
}

async function importSettings(targetRoot, sender) {
    try {
        // 1. Safety Check: Don't overwrite if target already has options.txt
        if (await fs.pathExists(path.join(targetRoot, 'options.txt'))) {
            // sender.send('log', 'El launcher ya está configurado. Saltando importación.');
            return;
        }

        sender.send('log', 'Buscando configuración antigua de TLauncher...');
        let sourceRoot = await findSourceRoot();

        if (!sourceRoot) {
            sender.send('log', 'No se encontraron instalaciones automáticas.');

            // Ask user manually
            const win = BrowserWindow.fromWebContents(sender);
            const { response } = await dialog.showMessageBox(win, {
                type: 'question',
                buttons: ['Sí, buscar carpeta', 'No, empezar de cero'],
                title: 'Importar Configuración',
                message: 'No se encontró ninguna instalación de Minecraft automáticamente.\n¿Quieres seleccionar la carpeta ".minecraft" manualmente para importar tus configuraciones (options.txt, xaero, etc.)?',
                defaultId: 0,
                cancelId: 1
            });

            if (response === 0) {
                const { canceled, filePaths } = await dialog.showOpenDialog(win, {
                    title: 'Selecciona tu carpeta .minecraft (o la carpeta de la instancia)',
                    properties: ['openDirectory']
                });

                if (!canceled && filePaths.length > 0) {
                    sourceRoot = filePaths[0];
                    // Basic validation
                    if (!await fs.pathExists(path.join(sourceRoot, 'options.txt'))) {
                        sender.send('log', '⚠️ La carpeta seleccionada no parece tener un archivo options.txt. Se intentará importar de todas formas.');
                    }
                } else {
                    sender.send('log', 'Selección manual cancelada.');
                    return;
                }
            } else {
                sender.send('log', 'Iniciando como instalación limpia.');
                return;
            }
        }

        sender.send('log', `Importando configuración desde: ${sourceRoot}`);

        // 2. Files/Folders to copy
        const itemsToCopy = [
            'options.txt',
            'xaero',
            'config'
        ];

        for (const item of itemsToCopy) {
            let sourcePath = path.join(sourceRoot, item);
            const targetPath = path.join(targetRoot, item);

            // Special handling for Xaero: Check root .minecraft if not found in instance folder
            if (item.toLowerCase().startsWith('xaero') && !await fs.pathExists(sourcePath)) {
                // If sourceRoot is inside 'versions', check the parent (.minecraft)
                if (sourceRoot.includes('versions')) {
                    // Actually, usually it's .minecraft/versions/aaa, so dirname is versions, dirname(dirname) is .minecraft
                    // Let's be safer: check if 'versions' is the parent
                    const upOne = path.dirname(sourceRoot);
                    if (path.basename(upOne) === 'versions') {
                        const rootMinecraft = path.dirname(upOne);
                        const rootPath = path.join(rootMinecraft, item);
                        if (await fs.pathExists(rootPath)) {
                            sourcePath = rootPath;
                            sender.send('log', `Encontrado ${item} en la carpeta raíz (.minecraft)`);
                        }
                    }
                }
            }

            if (await fs.pathExists(sourcePath)) {
                sender.send('log', `Copiando ${item}...`);
                await fs.copy(sourcePath, targetPath, { overwrite: false });
            }
        }

        sender.send('log', 'Importación completada con éxito.');
    } catch (error) {
        console.error('Error importing settings:', error);
        sender.send('log', `Error importando configuración: ${error.message}`);
    }
}

module.exports = { importSettings };
