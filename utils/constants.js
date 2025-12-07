const path = require('path');

const GAME_ROOT = process.env.OMBICRAFT_GAME_ROOT || path.join(process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME + '/.local/share'), '.minecraft_server_josh');

module.exports = {
    GAME_ROOT
};
