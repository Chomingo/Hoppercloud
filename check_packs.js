const fs = require('fs-extra');
const path = require('path');
const AdmZip = require('adm-zip');

async function checkPack(filePath) {
    try {
        const zip = new AdmZip(filePath);
        const index = JSON.parse(zip.readAsText('modrinth.index.json'));
        console.log(`Pack: ${index.name}`);
        console.log(`Version: ${index.versionId}`);
        console.log(`Dependencies:`, JSON.stringify(index.dependencies, null, 2));
    } catch (e) {
        console.error(`Error checking ${filePath}: ${e.message}`);
    }
}

async function main() {
    await checkPack('update_files/modpacks/Essentially Optimized 1.21.9 1.0.0.mrpack');
    await checkPack('update_files/modpacks/Horizon Modpack 1.0.2.mrpack');
}

main();
