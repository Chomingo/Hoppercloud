const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const AdmZip = require('adm-zip');
const { GAME_ROOT } = require('./constants');

class JavaManager {
    constructor(sender) {
        this.sender = sender;
        this.runtimeDir = path.join(GAME_ROOT, 'runtime', 'java21');
        this.javaPath = path.join(this.runtimeDir, 'bin', 'java.exe');
        // Direct link to latest Java 21 JRE for Windows x64 from Adoptium
        this.downloadUrl = 'https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jre/hotspot/normal/eclipse';
    }

    log(msg) {
        if (this.sender) {
            this.sender.send('log', msg);
        }
        console.log(`[JavaManager] ${msg}`);
    }

    async ensureJava() {
        if (await this.checkJavaExists()) {
            this.log(`Java 21 detectado en: ${this.javaPath}`);
            return this.javaPath;
        }

        this.log('Java 21 no encontrado. Iniciando descarga...');
        await this.downloadAndInstall();
        return this.javaPath;
    }

    async checkJavaExists() {
        return await fs.pathExists(this.javaPath);
    }

    async downloadAndInstall() {
        const zipPath = path.join(GAME_ROOT, 'runtime', 'java21.zip');
        const tempDir = path.join(GAME_ROOT, 'runtime', 'temp_extract');

        await fs.ensureDir(path.dirname(zipPath));

        // 1. Download
        this.log(`Descargando Java 21 desde Adoptium...`);
        const writer = fs.createWriteStream(zipPath);

        try {
            const response = await axios({
                url: this.downloadUrl,
                method: 'GET',
                responseType: 'stream'
            });

            const totalLength = response.headers['content-length'];
            let downloaded = 0;

            response.data.on('data', (chunk) => {
                downloaded += chunk.length;
                if (totalLength) {
                    const percent = Math.round((downloaded / totalLength) * 100);
                    // Optional: Send progress if needed, but 'log' is enough for now to avoid spamming
                    if (percent % 10 === 0) {
                        // this.log(`Descargando Java: ${percent}%`);
                    }
                }
            });

            response.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            this.log('Descarga completada. Extrayendo...');

            // 2. Extract
            const zip = new AdmZip(zipPath);
            zip.extractAllTo(tempDir, true);

            // 3. Move to final location
            // Adoptium zips usually have a root folder like 'jdk-21.0.x+y-jre'. We need to find it.
            const files = await fs.readdir(tempDir);
            const rootFolder = files.find(f => fs.statSync(path.join(tempDir, f)).isDirectory());

            if (!rootFolder) {
                throw new Error('No se encontró la carpeta raíz en el ZIP de Java.');
            }

            const sourcePath = path.join(tempDir, rootFolder);

            // Ensure clean state
            if (await fs.pathExists(this.runtimeDir)) {
                await fs.remove(this.runtimeDir);
            }

            await fs.move(sourcePath, this.runtimeDir);

            this.log('Java 21 instalado correctamente.');

        } catch (error) {
            this.log(`Error instalando Java: ${error.message}`);
            throw error;
        } finally {
            // Cleanup
            try {
                if (await fs.pathExists(zipPath)) await fs.remove(zipPath);
                if (await fs.pathExists(tempDir)) await fs.remove(tempDir);
            } catch (e) {
                console.error('Error limpiando archivos temporales:', e);
            }
        }
    }
}

module.exports = JavaManager;
