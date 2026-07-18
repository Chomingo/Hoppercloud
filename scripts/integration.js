const electronPath = require('electron');
const path = require('path');
const { spawn } = require('child_process');

// Simple integration test to check if the app launches without crashing immediately
// This is not a full UI test, but verifies the main process starts.

const appPath = path.join(__dirname, '..');

console.log('Starting application...');
const appProcess = spawn(electronPath, [appPath], {
    env: { ...process.env, NODE_ENV: 'test' }
});

let output = '';
let errorOutput = '';

appProcess.stdout.on('data', (data) => {
    output += data.toString();
    console.log(`[APP]: ${data}`);
});

appProcess.stderr.on('data', (data) => {
    errorOutput += data.toString();
    console.error(`[APP ERR]: ${data}`);
});

// Wait for 10 seconds then kill it
setTimeout(() => {
    console.log('Stopping application...');
    appProcess.kill();

    if (errorOutput.includes('Error') && !errorOutput.includes('DevTools')) {
        console.error('Test Failed: Errors detected in stderr');
        process.exit(1);
    } else {
        console.log('Test Passed: Application ran for 10s without critical errors.');
        process.exit(0);
    }
}, 10000);
