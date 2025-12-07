const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const generateManifestPath = path.join(__dirname, 'generate_manifest.js');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const BETA_RELEASE = args.includes('--beta');

// Helper to run commands
function run(command) {
    console.log(`\n> ${command}`);
    if (DRY_RUN) {
        console.log('   [DRY-RUN] Command skipped.');
        // Return mock values for commands that return output
        if (command.startsWith('npm version')) return 'v1.0.0-beta.0';
        return '';
    }
    try {
        return execSync(command, { cwd: __dirname, encoding: 'utf8' }).trim();
    } catch (e) {
        console.error(`Command failed: ${command}`);
        console.error(e.stdout);
        console.error(e.stderr);
        process.exit(1);
    }
}

const config = require('./launcher_builder_config.json');
const { ensureBranch } = require('./utils/git-check');
const { validateConfig } = require('./utils/config-validator');

async function main() {
    console.log('🚀 Starting Automated Release Process...');
    if (DRY_RUN) console.log('⚠️  DRY RUN MODE ENABLED: No changes will be made.');
    if (BETA_RELEASE) console.log('🧪 BETA RELEASE MODE: Targeting DEV branch.');

    // Override config branch if beta
    const targetBranch = BETA_RELEASE ? 'dev' : config.branch;

    // 0. Safety Check
    validateConfig();
    ensureBranch(targetBranch, DRY_RUN);

    // 1. Bump Version using npm (updates package.json AND package-lock.json)
    console.log('ℹ️  Bumping version...');
    // --no-git-tag-version because we handle tagging/releasing via gh cli later
    let versionCmd = 'npm version patch --no-git-tag-version';
    if (BETA_RELEASE) {
        versionCmd = 'npm version prerelease --preid=beta --no-git-tag-version';
    }

    const newVersionTag = run(versionCmd);
    const newVersion = newVersionTag.replace('v', ''); // e.g. "1.0.15"

    console.log(`✅ Version bumped to ${newVersion}`);

    // 2. Update generate_manifest.js
    if (!DRY_RUN) {
        let genManifestContent = await fs.readFile(generateManifestPath, 'utf8');
        genManifestContent = genManifestContent.replace(
            /const LAUNCHER_VERSION = ['"].*['"];/,
            `const LAUNCHER_VERSION = '${newVersion}';`
        );
        await fs.writeFile(generateManifestPath, genManifestContent);
    } else {
        console.log('   [DRY-RUN] Skipping generate_manifest.js update.');
    }

    // 3. Regenerate Manifest
    console.log('📦 Regenerating manifest...');
    run('node generate_manifest.js');

    // 4. Build
    console.log('🔨 Building application...');
    run('npm run dist');

    // 5. Git Operations
    console.log('Git: Adding changes...');
    run('git add .');

    console.log(`Git: Committing v${newVersion}...`);
    run(`git commit -m "chore: release v${newVersion}"`);

    console.log('Git: Pushing to remote...');
    console.log('Git: Pushing to remote...');
    run(`git push origin ${targetBranch}`);

    // 6. GitHub Release
    console.log(`☁️  Creating GitHub Release v${newVersion}...`);

    const distDir = path.join(__dirname, 'dist');
    const exeName = `Hoppersetup-${newVersion}.exe`;
    const exePath = path.join(distDir, exeName);
    const latestYmlPath = path.join(distDir, 'latest.yml');
    const blockmapPath = `${exePath}.blockmap`;

    // Verify files exist (Skip in dry-run as build is skipped)
    if (!DRY_RUN) {
        if (!fs.existsSync(exePath) || !fs.existsSync(latestYmlPath) || !fs.existsSync(blockmapPath)) {
            console.error('❌ Error: Missing build artifacts. Cannot release.');
            console.error(`Checked: \n - ${exePath}\n - ${latestYmlPath}\n - ${blockmapPath}`);
            process.exit(1);
        }
    } else {
        console.log('   [DRY-RUN] Skipping artifact verification.');
    }

    const notes = `Release v${newVersion}`;
    let releaseCmd = `gh release create v${newVersion} "${exePath}" "${latestYmlPath}" "${blockmapPath}" --notes "${notes}"`;

    if (BETA_RELEASE) {
        releaseCmd += ' --prerelease';
    }

    // Quote paths to handle spaces
    run(releaseCmd);

    console.log(`\n✅ Release v${newVersion} completed successfully!`);
}

main().catch(console.error);
