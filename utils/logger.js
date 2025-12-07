const log = require('electron-log');
const path = require('path');

// Configure main logger
log.transports.file.level = 'info';
log.transports.file.resolvePathFn = () => path.join(__dirname, '..', 'logs', 'main.log');

// Configure console logger (for game output)
const consoleLog = log.create('console');
consoleLog.transports.file.level = 'info';
consoleLog.transports.file.resolvePathFn = () => path.join(__dirname, '..', 'logs', 'console.log');
consoleLog.transports.console.level = false; // Don't print to stdout again

// Helper to clear logs
function clearLogs() {
    try {
        const fs = require('fs-extra');
        const logDir = path.join(__dirname, '..', 'logs');
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
