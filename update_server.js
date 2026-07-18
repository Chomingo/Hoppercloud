const fs = require('fs-extra');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const BETA_RELEASE = args.includes('--beta');

// Helper to run commands
function run(command) {
    console.log(`\n> ${command}`);
    if (DRY_RUN) {
        console.log('   [DRY-RUN] Command skipped.');
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
const { ensureBranch } = require('./scripts/git-check');
const { validateConfig } = require('./utils/config-validator');

async function main() {
    console.log('🚀 Starting Server Content Update...');
    if (DRY_RUN) console.log('⚠️  DRY RUN MODE ENABLED: No changes will be made.');
    if (BETA_RELEASE) console.log('🧪 BETA MODE: Targeting DEV branch.');

    // Override config branch if beta
    const targetBranch = BETA_RELEASE ? 'dev' : config.branch;

    // 0. Safety Check
    validateConfig();
    ensureBranch(targetBranch, DRY_RUN);

    console.log('   (This will update mods/configs/versions, NOT the launcher itself)');

    // 1. Regenerate Manifest
    console.log('📦 Regenerating manifest...');
    run('node generate_manifest.js');

    // 2. Git Operations
    console.log('Git: Adding changes...');
    run('git add .');

    // Check if there are changes to commit
    try {
        const status = run('git status --porcelain');
        if (!DRY_RUN && !status) {
            console.log('✨ No changes to commit. Everything is up to date.');
            return;
        } else if (DRY_RUN) {
            console.log('   [DRY-RUN] Skipping status check.');
        }
    } catch (e) {
        // Ignore error
    }

    const timestamp = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
    console.log(`Git: Committing updates (${timestamp})...`);
    run(`git commit -m "content: update game files ${timestamp}"`);

    console.log('Git: Pushing to remote...');
    run(`git push origin ${targetBranch}`);

    console.log('\n✅ Server update published successfully!');
    console.log('   Players will receive the new files next time they open the launcher.');
}

main().catch(console.error);
