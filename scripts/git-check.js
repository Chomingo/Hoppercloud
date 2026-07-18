const { execSync } = require('child_process');

function getCurrentBranch() {
    try {
        return execSync('git branch --show-current', { encoding: 'utf8' }).trim();
    } catch (e) {
        return null;
    }
}

function ensureBranch(requiredBranch, dryRun = false) {
    const current = getCurrentBranch();
    if (current !== requiredBranch) {
        console.error('\n❌ Error: Incorrect Branch!');
        console.error(`   Current branch: '${current}'`);
        console.error(`   Required branch: '${requiredBranch}' (from launcher_builder_config.json)`);

        if (dryRun) {
            console.warn('⚠️  [DRY-RUN] Ignoring branch check mismatch.');
            return;
        }

        console.error(`\n   Please switch to '${requiredBranch}' before running this script.`);
        console.error(`   > git checkout ${requiredBranch}\n`);
        process.exit(1);
    }
    console.log(`✅ Branch check passed: '${current}'`);
}

module.exports = { getCurrentBranch, ensureBranch };
