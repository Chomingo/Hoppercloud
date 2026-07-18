const log = require('electron-log');
const path = require('path');

// Resolve a writable logs directory.
// When packaged, __dirname points inside app.asar (a read-only archive), so we
// must write logs into the user's data directory instead. In development we
// keep the logs alongside the project for convenience.
function getLogDir() {
    try {
        // Lazy require: `app` is unavailable in some contexts (e.g. tests).
        const { app } = require('electron');
        if (app && typeof app.getPath === 'function') {
            return path.join(app.getPath('userData'), 'logs');
        }
    } catch (e) {
        // Fall through to the local path below.
    }
    return path.join(__dirname, '..', 'logs');
}

// Configure main logger
log.transports.file.level = 'info';
log.transports.file.resolvePathFn = () => path.join(getLogDir(), 'main.log');

// Configure console logger (for game output)
const consoleLog = log.create('console');
consoleLog.transports.file.level = 'info';
consoleLog.transports.file.resolvePathFn = () => path.join(getLogDir(), 'console.log');
consoleLog.transports.console.level = false; // Don't print to stdout again

// Helper to clear logs
function clearLogs() {
    try {
        const fs = require('fs-extra');
        const logDir = getLogDir();
        fs.ensureDirSync(logDir);
        fs.removeSync(path.join(logDir, 'console.log'));
        // We generally don't clear main.log on every start, but we could.
    } catch (e) {
        console.error('Failed to clear logs:', e);
    }
}

module.exports = {
    log,
    consoleLog,
    clearLogs
};
