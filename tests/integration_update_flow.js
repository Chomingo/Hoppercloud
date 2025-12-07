const path = require('path');
const fs = require('fs-extra');

// Mock config
const mockConfig = {
    gameVersion: '1.21.1',
    fabricLoaderVersion: '0.16.9',
    repoUser: 'Antaneyes',
    repoName: 'minecraft-launcher-custom',
    branch: 'dev'
};

async function runTest() {
    console.log('🧪 Starting Integration Test: Update Flow');

    const testDir = path.join(__dirname, 'temp_test_env');
    await fs.ensureDir(testDir);

    console.log(`   Test Directory: ${testDir}`);

    // Mock process.env BEFORE requiring GameUpdater
    process.env.OMBICRAFT_GAME_ROOT = testDir;

    // Require GameUpdater here so it picks up the new env var (if constants.js is not already cached)
    // Note: If constants.js was required elsewhere in this process, it might be cached.
    // To be safe, we should clear cache for constants.js
    try {
        const constantsPath = require.resolve('../utils/constants');
        delete require.cache[constantsPath];
    } catch (e) {
        // Ignore if not found
    }

    const GameUpdater = require('../utils/GameUpdater');

    try {
        const updater = new GameUpdater();
        console.log('   ✅ GameUpdater instantiated successfully.');

        // Verify properties
        if (updater.gameRoot !== testDir) {
            throw new Error(`Expected gameRoot to be ${testDir}, got ${updater.gameRoot}`);
        }
        console.log('   ✅ GameRoot correctly set.');

        // We can't easily test checkAndDownloadUpdates without mocking network or having a real repo.
        // But we can test if it fails gracefully or if we can mock the manifest fetch.
        // GameUpdater.js uses axios.

        // Let's just verify that the critical methods exist
        if (typeof updater.checkAndDownloadUpdates !== 'function') {
            throw new Error('checkAndDownloadUpdates is not a function');
        }
        console.log('   ✅ checkAndDownloadUpdates method exists.');

        console.log('✅ Integration Test Passed (Basic Initialization)');
    } catch (error) {
        console.error('❌ Test Failed:', error);
        process.exit(1);
    } finally {
        // Cleanup
        await fs.remove(testDir);
        console.log('   Cleanup complete.');
    }
}

runTest();
