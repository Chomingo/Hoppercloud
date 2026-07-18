const fs = require('fs-extra');
const path = require('path');
const { GAME_ROOT } = require('./constants');

/**
 * Safely cleans up temporary and non-essential files from the game directory.
 * @returns {Promise<{success: boolean, filesDeleted: number, spaceFreedMB: number, error: string|null}>}
 */
async function cleanupGameFiles() {
    let filesDeleted = 0;
    let totalSizeFreed = 0;

    const targets = [
        { path: 'logs', isDir: true, glob: '*.log.gz' }, // Comprimidos viejos
        { path: 'logs', isDir: true, glob: 'latest.log' }, // El log actual (opcional, pero ayuda)
        { path: 'crash-reports', isDir: true, glob: '*' }, // Reportes de error
        { path: 'nativelog.txt', isDir: false }, // Log de Java
        { path: '.mixin.out', isDir: true }, // Temporales de Mixin
        { path: 'webcache', isDir: true }, // Caché web de mods
        { path: 'launcher_log.txt', isDir: false } // Log del propio launcher (opcional)
    ];

    try {
        if (!fs.existsSync(GAME_ROOT)) return { success: true, filesDeleted: 0, spaceFreedMB: 0 };

        for (const target of targets) {
            const fullPath = path.join(GAME_ROOT, target.path);

            if (!fs.existsSync(fullPath)) continue;

            if (target.isDir) {
                if (target.glob === '*') {
                    // Borrar contenido del directorio pero mantener el directorio
                    const files = await fs.readdir(fullPath);
                    for (const file of files) {
                        const filePath = path.join(fullPath, file);
                        const stats = await fs.stat(filePath);
                        totalSizeFreed += stats.size;
                        await fs.remove(filePath);
                        filesDeleted++;
                    }
                } else if (target.glob) {
                    // Borrar archivos específicos dentro del directorio
                    const files = await fs.readdir(fullPath);
                    for (const file of files) {
                        if (file.endsWith(target.glob.replace('*', ''))) {
                            const filePath = path.join(fullPath, file);
                            const stats = await fs.stat(filePath);
                            totalSizeFreed += stats.size;
                            await fs.remove(filePath);
                            filesDeleted++;
                        }
                    }
                } else {
                    // Borrar el directorio completo
                    const stats = await fs.stat(fullPath);
                    totalSizeFreed += stats.size; // Esto es una aproximación para carpetas
                    await fs.remove(fullPath);
                    filesDeleted++;
                }
            } else {
                // Borrar archivo individual
                const stats = await fs.stat(fullPath);
                totalSizeFreed += stats.size;
                await fs.remove(fullPath);
                filesDeleted++;
            }
        }

        const spaceFreedMB = (totalSizeFreed / (1024 * 1024)).toFixed(2);
        return { success: true, filesDeleted, spaceFreedMB: parseFloat(spaceFreedMB), error: null };

    } catch (error) {
        console.error('Error during cleanup:', error);
        return { success: false, filesDeleted, spaceFreedMB: 0, error: error.message };
    }
}

module.exports = { cleanupGameFiles };
