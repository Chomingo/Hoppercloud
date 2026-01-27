const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { getCurrentBranch } = require('./utils/git-check');

// CONFIGURATION
const config = require('./launcher_builder_config.json');

const REQUIRED_FIELDS = ['repoUser', 'repoName', 'branch', 'fabricLoaderVersion', 'gameVersion'];
const missingFields = REQUIRED_FIELDS.filter(field => !config[field]);

if (missingFields.length > 0) {
    console.error(`Error: Missing required fields in launcher_builder_config.json: ${missingFields.join(', ')}`);
    process.exit(1);
}

const REPO_USER = config.repoUser;
const REPO_NAME = config.repoName;
// Use current branch if available, otherwise fallback to config
const currentBranch = getCurrentBranch();
const BRANCH = currentBranch || config.branch;
console.log(`Using branch for URLs: ${BRANCH}`);

const BASE_URL = `https://raw.githubusercontent.com/${REPO_USER}/${REPO_NAME}/${BRANCH}/update_files`;

const UPDATE_DIR = path.join(__dirname, 'update_files');
const MANIFEST_PATH = path.join(__dirname, 'manifest.json');

// Game version to enforce
const GAME_VERSION = `fabric-loader-${config.fabricLoaderVersion}-${config.gameVersion}`;
const MANIFEST_VERSION = new Date().toISOString().split('T')[0].replace(/-/g, '.'); // e.g., 2023.11.22

function getFileHash(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('sha1');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
}

function scanDirectory(dir, fileList = []) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            scanDirectory(filePath, fileList);
        } else {
            const relativePath = path.relative(UPDATE_DIR, filePath).replace(/\\/g, '/');

            // Skip hidden files or system files
            if (file.startsWith('.') || file === 'Thumbs.db') return;

            fileList.push({
                path: relativePath,
                url: `${BASE_URL}/${relativePath}`,
                sha1: getFileHash(filePath),
                size: stat.size
            });
        }
    });

    return fileList;
}

console.log(`Scanning ${UPDATE_DIR}...`);

if (!fs.existsSync(UPDATE_DIR)) {
    console.error(`Error: Directory ${UPDATE_DIR} does not exist.`);
    process.exit(1);
}

const files = scanDirectory(UPDATE_DIR);

const LAUNCHER_VERSION = '1.1.1';

const manifest = {
    version: MANIFEST_VERSION,
    gameVersion: GAME_VERSION,
    launcherVersion: LAUNCHER_VERSION,
    launcherUrl: `https://github.com/${REPO_USER}/${REPO_NAME}/releases/download/v${LAUNCHER_VERSION}/horizonsetup-${LAUNCHER_VERSION}.exe`,
    files
};

fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 4));

console.log(`Manifest generated at ${MANIFEST_PATH}`);
console.log(`Total files: ${files.length}`);
console.log(`Version: ${MANIFEST_VERSION}`);
console.log(`LAUNCHER_VERSION=${LAUNCHER_VERSION}`);
