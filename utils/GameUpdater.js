const EventEmitter = require('events');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const { GAME_ROOT } = require('./constants');
const { app } = require('electron');
const AdmZip = require('adm-zip');

class GameUpdater extends EventEmitter {
    constructor() {
        super();
        this.gameRoot = GAME_ROOT;
        this.concurrencyLimit = 10;
        this.preservedFiles = ['options.txt', 'optionsof.txt', 'optionsshaders.txt', 'servers.dat'];
        this.localManifest = null;
    }

    log(message) {
        // En modo desarrollo (npm start), mostramos todo el detalle técnico
        if (!app.isPackaged) {
            this.emit('log', message);
            return;
        }

        // En el .exe final, filtramos contenido sensible
        let safeMessage = message;

        // Si el mensaje contiene una URL, lo simplificamos
        if (message.includes('http://') || message.includes('https://')) {
            if (message.includes('manifest.json') || message.includes('Verificando actualizaciones para:')) {
                safeMessage = 'Buscando actualizaciones en el servidor...';
            } else if (message.includes('.mrpack')) {
                safeMessage = 'Descargando configuración del modpack...';
            } else {
                safeMessage = 'Conectando con el servidor de archivos...';
            }
        }

        // Si el mensaje menciona rutas de mods o archivos específicos, lo hacemos genérico
        if (message.startsWith('Descargando:') || message.startsWith('Descargando mod:')) {
            safeMessage = 'Actualizando archivos del juego...';
        }

        if (message.startsWith('Eliminando mod antiguo:')) {
            safeMessage = 'Limpiando archivos antiguos...';
        }

        this.emit('log', safeMessage);
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

    // Removed getChannel/setChannel/getUpdateUrl as we now use dynamic branches passed via IPC

    async calculateHash(filePath) {
        return new Promise((resolve, reject) => {
            const hash = crypto.createHash('sha1');
            const stream = fs.createReadStream(filePath);
            stream.on('error', err => reject(err));
            stream.on('data', chunk => hash.update(chunk));
            stream.on('end', () => resolve(hash.digest('hex')));
        });
    }

    /**
     * @param {string} targetGameDir - Directory where updates should be applied
     * @param {string} manifestUrl - Full URL to the manifest.json
     */
    async checkAndDownloadUpdates(targetGameDir = this.gameRoot, manifestUrl) {
        try {
            await fs.ensureDir(targetGameDir);
        } catch (e) {
            throw new Error(`No se pudo crear el directorio del juego: ${e.message}`);
        }

        // Use defaults if not provided (fallback)
        if (!manifestUrl) {
            manifestUrl = 'https://raw.githubusercontent.com/Chomingo/Hoppercloud/master/manifest.json';
        }

        this.log(`Buscando actualizaciones en: ${manifestUrl}`);

        // Load local manifest for caching
        try {
            const localManifestPath = path.join(targetGameDir, 'client-manifest.json');
            if (await fs.pathExists(localManifestPath)) {
                this.localManifest = await fs.readJson(localManifestPath);
            }
        } catch (e) {
            this.localManifest = null;
        }

        let manifest;

        // DEV MODE: Read local manifest (Simplified)
        if (!app.isPackaged && manifestUrl === 'local') {
            // Logic for local testing if needed
        }

        if (!manifest) {
            try {
                const response = await axios.get(`${manifestUrl}?t=${Date.now()}`);
                manifest = response.data;

                // Save the base URL of the manifest for resolving relative paths later
                if (manifestUrl.startsWith('http')) {
                    manifest.url_base = manifestUrl.substring(0, manifestUrl.lastIndexOf('/'));
                }
            } catch (e) {
                if (e.code === 'ENOTFOUND' || e.code === 'ETIMEDOUT') {
                    this.log('No se pudo conectar al servidor de actualizaciones (Sin internet o servidor caído).');
                } else if (e.response && e.response.status === 404) {
                    this.log(`Error 404: No se encontró el manifest en ${manifestUrl}. Asegúrate de que existe.`);
                } else {
                    this.log(`Error descargando manifiesto: ${e.message}`);
                }
                this.log('Saltando actualización...');
                return;
            }
        }

        this.log(`Versión remota: ${manifest.version}`);

        // Validate Manifest
        if (!manifest.gameVersion || !manifest.files) {
            throw new Error("Manifiesto inválido: Falta 'gameVersion' o 'files'.");
        }

        if (manifest.files && Array.isArray(manifest.files)) {
            try {
                await this.cleanupOldMods(manifest, targetGameDir);
            } catch (e) {
                this.log(`Advertencia: Fallo al limpiar mods antiguos: ${e.message}`);
            }

            try {
                await this.downloadFiles(manifest, targetGameDir);
            } catch (e) {
                throw new Error(`Fallo durante la descarga de archivos: ${e.message}`);
            }

            if (manifest.mrpack) {
                try {
                    if (Array.isArray(manifest.mrpack)) {
                        for (const packPath of manifest.mrpack) {
                            await this.handleMrPack(packPath, manifest.url_base, targetGameDir);
                        }
                    } else {
                        await this.handleMrPack(manifest.mrpack, manifest.url_base, targetGameDir);
                    }
                } catch (e) {
                    this.log(`Error procesando Modpacks (.mrpack): ${e.message}`);
                }
            }

            try {
                await this.patchFabric(manifest); // Shared logic, usually installs to global versions default
            } catch (e) {
                throw new Error(`Fallo al instalar/parchear Fabric: ${e.message}`);
            }

            this.log('Todas las actualizaciones descargadas.');

            try {
                await fs.writeJson(path.join(targetGameDir, 'client-manifest.json'), manifest);
            } catch (e) {
                this.log(`Advertencia: No se pudo guardar client-manifest.json: ${e.message}`);
            }
        }
    }

    async cleanupOldMods(manifest, targetGameDir) {
        const adminFile = path.join(targetGameDir, '.admin');
        if (await fs.pathExists(adminFile)) {
            this.log('MODO ADMIN DETECTADO: Saltando limpieza de mods antiguos.');
            return;
        }

        const modsDir = path.join(targetGameDir, 'mods');
        if (await fs.pathExists(modsDir)) {
            const localMods = await fs.readdir(modsDir);
            const manifestModNames = manifest.files
                .filter(f => f.path.startsWith('mods/'))
                .map(f => path.basename(f.path));

            for (const file of localMods) {
                if (!manifestModNames.includes(file)) {
                    this.log(`Eliminando mod antiguo: ${file}`);
                    const filePath = path.join(modsDir, file);
                    await this.retryOperation(() => fs.remove(filePath));
                }
            }
        }
    }

    async retryOperation(operation, maxRetries = 3, delay = 1000) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                return await operation();
            } catch (err) {
                if (err.code === 'EBUSY' && i < maxRetries - 1) {
                    this.log(`Archivo ocupado, reintentando en ${delay}ms... (Intento ${i + 1}/${maxRetries})`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    throw err;
                }
            }
        }
    }

    async downloadFiles(manifest, targetGameDir) {
        let processed = 0;
        const total = manifest.files.length;

        const downloadFile = async (file) => {
            try {
                const destPath = path.join(targetGameDir, file.path);
                const fileName = path.basename(file.path);


                if (this.preservedFiles.includes(fileName) && await fs.pathExists(destPath)) {
                    this.log(`Conservando archivo de usuario: ${fileName}`);
                    processed++;
                    this.emit('progress', { current: processed, total, type: 'update' });
                    return;
                }

                // DEV MODE: Copy from local
                if (!app.isPackaged) {
                    const localSourcePath = path.join(__dirname, '..', 'update_files', file.path);
                    if (await fs.pathExists(localSourcePath)) {
                        this.log(`[DEV] Copiando localmente: ${file.path}`);
                        await fs.ensureDir(path.dirname(destPath));
                        await this.retryOperation(() => fs.copy(localSourcePath, destPath));
                        processed++;
                        this.emit('progress', { current: processed, total, type: 'update' });
                        return;
                    }
                }

                let skipDownload = false;
                let verificationMethod = '';

                // Tier 1: Check local manifest cache (Highest Performance)
                const localFile = this.localManifest && this.localManifest.files
                    ? this.localManifest.files.find(f => f.path === file.path)
                    : null;

                if (await fs.pathExists(destPath)) {
                    if (localFile && file.sha1 && localFile.sha1 === file.sha1) {
                        skipDownload = true;
                        verificationMethod = 'caché';
                    } else if (file.size !== undefined) {
                        // Tier 2: Check file size (Medium Performance)
                        const stats = await fs.stat(destPath);
                        if (stats.size === file.size) {
                            if (!file.sha1) {
                                skipDownload = true;
                                verificationMethod = 'tamaño';
                            } else {
                                // Tier 3: Verify SHA1 only if size matches but not in cache
                                this.log(`Verificando integridad: ${fileName}`);
                                const localHash = await this.calculateHash(destPath);
                                if (localHash === file.sha1) {
                                    skipDownload = true;
                                    verificationMethod = 'hash';
                                }
                            }
                        }
                    } else if (file.sha1) {
                        // Fallback Tier 3: Mandatory hash check if no size or cache
                        this.log(`Verificando integridad: ${fileName}`);
                        const localHash = await this.calculateHash(destPath);
                        if (localHash === file.sha1) {
                            skipDownload = true;
                            verificationMethod = 'hash';
                        }
                    }
                }

                if (skipDownload) {
                    processed++;
                    // Emitir progreso con throttling para no saturar el canal IPC
                    if (processed === total || processed % 5 === 0) {
                        this.emit('progress', { current: processed, total, type: 'update' });
                    }
                    return;
                }

                this.log(`Actualizando: ${file.path}`);
                await fs.ensureDir(path.dirname(destPath));

                await this.retryOperation(async () => {
                    const writer = fs.createWriteStream(destPath);
                    try {
                        const response = await axios({
                            url: encodeURI(file.url),
                            method: 'GET',
                            responseType: 'stream'
                        });

                        response.data.pipe(writer);

                        await new Promise((resolve, reject) => {
                            writer.on('finish', resolve);
                            writer.on('error', (err) => {
                                writer.close();
                                reject(err);
                            });
                        });
                    } catch (err) {
                        writer.close();
                        throw err;
                    }
                });

                if (file.sha1) {
                    const newHash = await this.calculateHash(destPath);
                    if (newHash !== file.sha1) {
                        const msg = `ADVERTENCIA HASH: ${file.path} | Esperado: ${file.sha1} | Obtenido: ${newHash}`;
                        console.warn(msg);
                        this.log(msg);
                    }
                }

                processed++;
                this.emit('progress', { current: processed, total, type: 'update' });
            } catch (fileErr) {
                if (fileErr.response && fileErr.response.status === 404) {
                    this.log(`ADVERTENCIA: Archivo no encontrado (404): ${file.path}. Saltando...`);
                } else {
                    this.log(`ERROR descargando ${file.path}: ${fileErr.message}`);
                    throw fileErr;
                }
            }
        };

        for (let i = 0; i < manifest.files.length; i += this.concurrencyLimit) {
            const chunk = manifest.files.slice(i, i + this.concurrencyLimit);
            await Promise.all(chunk.map(downloadFile));
        }
    }

    async handleMrPack(mrpackRelativePath, urlBase, targetGameDir) {
        const packFileName = path.basename(mrpackRelativePath);
        const mrpackLocalPath = path.join(targetGameDir, `.temp_${packFileName}`);
        let mrpackSourcePath;

        // 1. Resolve source
        if (mrpackRelativePath.startsWith('http')) {
            this.log(`Descargando archivo .mrpack: ${packFileName}...`);
            mrpackSourcePath = mrpackLocalPath;
            const response = await axios({
                url: mrpackRelativePath,
                method: 'GET',
                responseType: 'stream'
            });
            const writer = fs.createWriteStream(mrpackSourcePath);
            response.data.pipe(writer);
            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });
        } else {
            // 2. Resolve source (Local or Remote)
            mrpackSourcePath = path.join(__dirname, '..', mrpackRelativePath);

            if (!await fs.pathExists(mrpackSourcePath)) {
                // Try relative to targetGameDir as fallback
                mrpackSourcePath = path.join(targetGameDir, mrpackRelativePath);
            }

            // 3. Fallback to Remote: If not found locally, try relative to the manifest URL
            if (!await fs.pathExists(mrpackSourcePath) && urlBase) {
                this.emit('log', `Archivo ${packFileName} no encontrado localmente. Intentando descarga remota...`);
                const remoteUrl = encodeURI(`${urlBase}/${mrpackRelativePath}`);

                // Reuse download logic
                mrpackSourcePath = mrpackLocalPath;
                const response = await axios({
                    url: remoteUrl,
                    method: 'GET',
                    responseType: 'stream'
                });
                const writer = fs.createWriteStream(mrpackSourcePath);
                response.data.pipe(writer);
                await new Promise((resolve, reject) => {
                    writer.on('finish', resolve);
                    writer.on('error', reject);
                });
            }
        }

        if (!await fs.pathExists(mrpackSourcePath)) {
            throw new Error(`Archivo .mrpack no encontrado en: ${mrpackSourcePath}`);
        }

        this.log('Procesando archivo .mrpack...');
        const zip = new AdmZip(mrpackSourcePath);
        const tempDir = path.join(targetGameDir, '.mrpack_temp');
        await fs.ensureDir(tempDir);
        zip.extractAllTo(tempDir, true);

        const indexPath = path.join(tempDir, 'modrinth.index.json');
        if (!await fs.pathExists(indexPath)) {
            throw new Error('El archivo .mrpack no es válido (falta modrinth.index.json)');
        }

        const index = await fs.readJson(indexPath);
        this.log(`Instalando Modpack: ${index.name} v${index.versionId}`);

        // 2. Install Mods from Index
        let processed = 0;
        const total = index.files.length;

        const downloadMod = async (file) => {
            // mrpack files usually have 'path' like 'mods/sodium.jar'
            const destPath = path.join(targetGameDir, file.path);

            // Check cache
            if (await fs.pathExists(destPath)) {
                if (file.hashes && file.hashes.sha1) {
                    const localHash = await this.calculateHash(destPath);
                    if (localHash === file.hashes.sha1) {
                        processed++;
                        if (processed % 5 === 0 || processed === total) {
                            this.emit('progress', { current: processed, total, type: 'update' });
                        }
                        return;
                    }
                }
            }

            if (!file.downloads || file.downloads.length === 0) {
                this.log(`ADVERTENCIA: No se encontraron URLs de descarga para ${file.path}`);
                processed++;
                return;
            }

            this.log(`Descargando archivo del pack: ${file.path}`);
            await fs.ensureDir(path.dirname(destPath));

            await this.retryOperation(async () => {
                const response = await axios({
                    url: file.downloads[0],
                    method: 'GET',
                    responseType: 'stream',
                    timeout: 30000
                });

                const writer = fs.createWriteStream(destPath);
                response.data.pipe(writer);

                await new Promise((resolve, reject) => {
                    writer.on('finish', resolve);
                    writer.on('error', (err) => {
                        writer.close();
                        reject(err);
                    });
                    response.data.on('error', (err) => {
                        writer.close();
                        reject(err);
                    });
                });
            });

            processed++;
            this.emit('progress', { current: processed, total, type: 'update' });
        };

        // Download mods with concurrency
        for (let i = 0; i < index.files.length; i += this.concurrencyLimit) {
            const chunk = index.files.slice(i, i + this.concurrencyLimit);
            await Promise.all(chunk.map(downloadMod));
        }

        // 3. Handle Overrides
        const overridesDir = path.join(tempDir, 'overrides');
        const clientOverridesDir = path.join(tempDir, 'client-overrides');

        if (await fs.pathExists(overridesDir)) {
            this.log('Aplicando configuraciones base...');
            await fs.copy(overridesDir, targetGameDir);
        }

        if (await fs.pathExists(clientOverridesDir)) {
            this.log('Aplicando configuraciones de cliente...');
            await fs.copy(clientOverridesDir, targetGameDir);
        }

        // Cleanup temp
        await fs.remove(tempDir);
        this.log('Modpack instalado correctamente.');
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
            this.log(`Error: Formato de versión desconocido: ${manifest.gameVersion}`);
            throw new Error("Formato de versión inválido. Debe ser 'fabric-loader-LOADER-MC'");
        }

        if (!await fs.pathExists(targetJsonPath)) {
            this.log(`Versión ${targetVersion} no detectada. Instalando...`);

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
                this.log(`Instalación de ${targetVersion} completada.`);
            } catch (e) {
                this.log(`ERROR CRÍTICO instalando versión: ${e.message}`);
                throw e;
            }
        }
    }
}

module.exports = GameUpdater;
