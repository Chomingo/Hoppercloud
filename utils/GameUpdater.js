const EventEmitter = require('events');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const { GAME_ROOT } = require('./constants');
const { app } = require('electron');

class GameUpdater extends EventEmitter {
    constructor() {
        super();
        this.gameRoot = GAME_ROOT;
        this.configPath = path.join(this.gameRoot, 'launcher-config.json');
        this.channels = {
            master: 'https://raw.githubusercontent.com/Antaneyes/minecraft-launcher-custom/master/manifest.json',
            beta: 'https://raw.githubusercontent.com/Antaneyes/minecraft-launcher-custom/dev/manifest.json'
        };
        this.defaultChannel = 'master';
        this.concurrencyLimit = 5;
        this.preservedFiles = ['options.txt', 'optionsof.txt', 'optionsshaders.txt', 'servers.dat'];
    }

    static compareVersions(v1, v2) {
        const parts1 = v1.split('.').map(Number);
        const parts2 = v2.split('.').map(Number);

        for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
            const val1 = parts1[i] || 0;
            const val2 = parts2[i] || 0;
            if (val1 > val2) return 1;
            if (val1 < val2) return -1;
        }
        return 0;
    }

    async getChannel() {
        try {
            if (await fs.pathExists(this.configPath)) {
                const config = await fs.readJson(this.configPath);
                if (config.channel && this.channels[config.channel]) {
                    return config.channel;
                }
            }
        } catch (e) {
            console.error('Error reading config for channel:', e);
        }
        return this.defaultChannel;
    }

    async setChannel(channel) {
        if (!this.channels[channel]) {
            throw new Error(`Canal inválido: ${channel}`);
        }

        let config = {};
        try {
            if (await fs.pathExists(this.configPath)) {
                config = await fs.readJson(this.configPath);
            }
        } catch (e) {
            // Ignore error, start with empty config
        }

        config.channel = channel;
        // Remove explicit updateUrl if setting a standard channel to avoid conflicts
        delete config.updateUrl;

        await fs.ensureDir(this.gameRoot);
        await fs.writeJson(this.configPath, config, { spaces: 4 });
        this.emit('log', `Canal de actualización cambiado a: ${channel}`);
    }

    async getUpdateUrl() {
        try {
            if (await fs.pathExists(this.configPath)) {
                const config = await fs.readJson(this.configPath);

                // If specific updateUrl is set (legacy or custom), use it
                if (config.updateUrl) return config.updateUrl;

                // Check for channel
                if (config.channel && this.channels[config.channel]) {
                    return this.channels[config.channel];
                }
            }
        } catch (e) {
            console.error('Error reading config:', e);
        }
        return this.channels[this.defaultChannel];
    }

    async calculateHash(filePath) {
        return new Promise((resolve, reject) => {
            const hash = crypto.createHash('sha1');
            const stream = fs.createReadStream(filePath);
            stream.on('error', err => reject(err));
            stream.on('data', chunk => hash.update(chunk));
            stream.on('end', () => resolve(hash.digest('hex')));
        });
    }

    async checkAndDownloadUpdates() {
        try {
            await fs.ensureDir(this.gameRoot);
        } catch (e) {
            throw new Error(`No se pudo crear el directorio del juego: ${e.message}`);
        }

        let updateUrl;
        try {
            updateUrl = await this.getUpdateUrl();
            this.emit('log', `Buscando actualizaciones en: ${updateUrl}`);
        } catch (e) {
            this.emit('log', 'Error obteniendo URL de actualización. Usando predeterminada.');
            updateUrl = this.defaultUpdateUrl;
        }

        let manifest;

        // DEV MODE: Read local manifest
        if (!app.isPackaged) {
            const localManifestPath = path.join(__dirname, '..', 'manifest.json');
            if (await fs.pathExists(localManifestPath)) {
                this.emit('log', 'MODO DEV: Usando manifest.json local.');
                try {
                    manifest = await fs.readJson(localManifestPath);
                } catch (e) {
                    this.emit('error', `Error leyendo manifest local: ${e.message}`);
                    return;
                }
            }
        }

        if (!manifest) {
            try {
                const response = await axios.get(`${updateUrl}?t=${Date.now()}`);
                manifest = response.data;
            } catch (e) {
                if (e.code === 'ENOTFOUND' || e.code === 'ETIMEDOUT') {
                    this.emit('log', 'No se pudo conectar al servidor de actualizaciones (Sin internet o servidor caído).');
                } else {
                    this.emit('log', `Error descargando manifiesto: ${e.message}`);
                }
                this.emit('log', 'Saltando actualización...');
                return;
            }
        }

        this.emit('log', `Versión remota: ${manifest.version}`);

        // Validate Manifest
        if (!manifest.gameVersion || !manifest.files) {
            throw new Error("Manifiesto inválido: Falta 'gameVersion' o 'files'.");
        }

        if (manifest.files && Array.isArray(manifest.files)) {
            try {
                await this.cleanupOldMods(manifest);
            } catch (e) {
                this.emit('log', `Advertencia: Fallo al limpiar mods antiguos: ${e.message}`);
            }

            try {
                await this.downloadFiles(manifest);
            } catch (e) {
                throw new Error(`Fallo durante la descarga de archivos: ${e.message}`);
            }

            try {
                await this.patchFabric(manifest);
            } catch (e) {
                throw new Error(`Fallo al instalar/parchear Fabric: ${e.message}`);
            }

            this.emit('log', 'Todas las actualizaciones descargadas.');

            try {
                await fs.writeJson(path.join(this.gameRoot, 'client-manifest.json'), manifest);
            } catch (e) {
                this.emit('log', `Advertencia: No se pudo guardar client-manifest.json: ${e.message}`);
            }
        }
    }

    async cleanupOldMods(manifest) {
        const adminFile = path.join(this.gameRoot, '.admin');
        if (await fs.pathExists(adminFile)) {
            this.emit('log', 'MODO ADMIN DETECTADO: Saltando limpieza de mods antiguos.');
            return;
        }

        const modsDir = path.join(this.gameRoot, 'mods');
        if (await fs.pathExists(modsDir)) {
            const localMods = await fs.readdir(modsDir);
            const manifestModNames = manifest.files
                .filter(f => f.path.startsWith('mods/'))
                .map(f => path.basename(f.path));

            for (const file of localMods) {
                if (!manifestModNames.includes(file)) {
                    this.emit('log', `Eliminando mod antiguo: ${file}`);
                    await fs.remove(path.join(modsDir, file));
                }
            }
        }
    }

    async downloadFiles(manifest) {
        let processed = 0;
        const total = manifest.files.length;

        const downloadFile = async (file) => {
            const destPath = path.join(this.gameRoot, file.path);
            const fileName = path.basename(file.path);

            if (this.preservedFiles.includes(fileName) && await fs.pathExists(destPath)) {
                this.emit('log', `Conservando archivo de usuario: ${fileName}`);
                processed++;
                this.emit('progress', { current: processed, total, type: 'update' });
                return;
            }

            // DEV MODE: Copy from local
            if (!app.isPackaged) {
                const localSourcePath = path.join(__dirname, '..', 'update_files', file.path);
                if (await fs.pathExists(localSourcePath)) {
                    this.emit('log', `[DEV] Copiando localmente: ${file.path}`);
                    await fs.ensureDir(path.dirname(destPath));
                    await fs.copy(localSourcePath, destPath);
                    processed++;
                    this.emit('progress', { current: processed, total, type: 'update' });
                    return;
                }
            }

            // Check existing file
            if (await fs.pathExists(destPath)) {
                if (file.sha1) {
                    const localHash = await this.calculateHash(destPath);
                    if (localHash === file.sha1) {
                        processed++;
                        this.emit('progress', { current: processed, total, type: 'update' });
                        return;
                    }
                }
            }

            this.emit('log', `Descargando: ${file.path}`);
            await fs.ensureDir(path.dirname(destPath));

            try {
                const writer = fs.createWriteStream(destPath);
                const response = await axios({
                    url: encodeURI(file.url),
                    method: 'GET',
                    responseType: 'stream'
                });

                response.data.pipe(writer);

                await new Promise((resolve, reject) => {
                    writer.on('finish', resolve);
                    writer.on('error', reject);
                });

                if (file.sha1) {
                    const newHash = await this.calculateHash(destPath);
                    if (newHash !== file.sha1) {
                        const msg = `ADVERTENCIA HASH: ${file.path} | Esperado: ${file.sha1} | Obtenido: ${newHash}`;
                        console.warn(msg);
                        this.emit('log', msg);
                    }
                }

                processed++;
                this.emit('progress', { current: processed, total, type: 'update' });
            } catch (fileErr) {
                if (fileErr.response && fileErr.response.status === 404) {
                    this.emit('log', `ADVERTENCIA: Archivo no encontrado (404): ${file.path}. Saltando...`);
                } else {
                    this.emit('log', `ERROR descargando ${file.path}: ${fileErr.message}`);
                    throw fileErr;
                }
            }
        };

        for (let i = 0; i < manifest.files.length; i += this.concurrencyLimit) {
            const chunk = manifest.files.slice(i, i + this.concurrencyLimit);
            await Promise.all(chunk.map(downloadFile));
        }
    }

    async patchFabric(manifest) {
        const versionsDir = path.join(this.gameRoot, 'versions');
        const targetVersion = manifest.gameVersion;
        const targetVersionDir = path.join(versionsDir, targetVersion);
        const targetJsonPath = path.join(targetVersionDir, `${targetVersion}.json`);

        const versionParts = manifest.gameVersion.split('-');
        let mcVersion, loaderVersion;

        if (versionParts.length >= 4) {
            loaderVersion = versionParts[2];
            mcVersion = versionParts.slice(3).join('-');
        } else {
            this.emit('log', `Error: Formato de versión desconocido: ${manifest.gameVersion}`);
            throw new Error("Formato de versión inválido. Debe ser 'fabric-loader-LOADER-MC'");
        }

        if (!await fs.pathExists(targetJsonPath)) {
            this.emit('log', `Versión ${targetVersion} no detectada. Instalando...`);

            try {
                await fs.ensureDir(targetVersionDir);
                const fabricMetaUrl = `https://meta.fabricmc.net/v2/versions/loader/${mcVersion}/${loaderVersion}/profile/json`;
                const response = await axios.get(fabricMetaUrl);
                const fabricJson = response.data;
                fabricJson.id = targetVersion;

                const vanillaMetaUrl = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';
                const vmResponse = await axios.get(vanillaMetaUrl);
                const vanillaVersionInfo = vmResponse.data.versions.find(v => v.id === mcVersion);

                if (!vanillaVersionInfo) throw new Error(`Versión Vanilla ${mcVersion} no encontrada.`);

                const vResponse = await axios.get(vanillaVersionInfo.url);
                const vanillaJson = vResponse.data;

                const existingLibs = new Set(fabricJson.libraries.map(l => l.name.split(':')[0] + ':' + l.name.split(':')[1]));

                vanillaJson.libraries.forEach(lib => {
                    const libName = lib.name.split(':')[0] + ':' + lib.name.split(':')[1];
                    if (!existingLibs.has(libName)) {
                        fabricJson.libraries.push(lib);
                    }
                });

                if (!fabricJson.arguments) fabricJson.arguments = {};
                if (vanillaJson.arguments) {
                    const fabricGameArgs = fabricJson.arguments.game || [];
                    const vanillaGameArgs = vanillaJson.arguments.game || [];
                    fabricJson.arguments.game = [...vanillaGameArgs, ...fabricGameArgs];

                    const fabricJvmArgs = fabricJson.arguments.jvm || [];
                    const vanillaJvmArgs = vanillaJson.arguments.jvm || [];
                    fabricJson.arguments.jvm = [...vanillaJvmArgs, ...fabricJvmArgs];
                }

                fabricJson.assets = vanillaJson.assets;
                fabricJson.assetIndex = vanillaJson.assetIndex;
                fabricJson.downloads = vanillaJson.downloads;

                fabricJson.libraries.forEach(lib => {
                    try {
                        if (!lib.downloads) lib.downloads = {};
                        if (!lib.downloads.artifact) {
                            const parts = lib.name.split(':');
                            if (parts.length < 3) return;

                            const domain = parts[0].replace(/\./g, '/');
                            const name = parts[1];
                            const version = parts[2];
                            const path = `${domain}/${name}/${version}/${name}-${version}.jar`;

                            let baseUrl = 'https://libraries.minecraft.net/';
                            if (lib.url) baseUrl = lib.url;
                            else if (parts[0].includes('fabricmc') || parts[0].includes('ow2') || parts[0].includes('jetbrains')) {
                                baseUrl = 'https://maven.fabricmc.net/';
                            }

                            lib.downloads.artifact = {
                                path,
                                url: baseUrl + path,
                                size: 0
                            };
                        }
                    } catch (err) {
                        console.error(`Error fixing library ${lib.name}:`, err);
                    }
                });

                delete fabricJson.inheritsFrom;

                await fs.writeJson(targetJsonPath, fabricJson, { spaces: 4 });
                this.emit('log', `Instalación de ${targetVersion} completada.`);
            } catch (e) {
                this.emit('log', `ERROR CRÍTICO instalando versión: ${e.message}`);
                throw e;
            }
        }
    }
}

module.exports = GameUpdater;
