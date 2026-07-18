const msmc = require('msmc');
const path = require('path');
const fs = require('fs-extra');
const { GAME_ROOT } = require('./constants');

const AUTH_CACHE = path.join(GAME_ROOT, 'auth_cache.json');

async function loginMicrosoft(sender) {
    try {
        const authManager = new msmc.Auth('select_account');
        let xboxManager;

        // 1. Try to refresh
        try {
            if (await fs.pathExists(AUTH_CACHE)) {
                sender.send('log', 'Intentando restaurar sesión...');
                const cache = await fs.readJson(AUTH_CACHE);
                xboxManager = await authManager.refresh(cache);
                sender.send('log', 'Sesión restaurada correctamente.');
            }
        } catch (e) {
            sender.send('log', 'Sesión expirada o inválida. Iniciando login...');
        }

        // 2. If no valid session, launch login
        if (!xboxManager) {
            // Launch the login window
            xboxManager = await authManager.launch('electron');

            // Save the refresh token/profile
            // msmc 5: xboxManager.save() returns the object needed for refresh
            const profile = xboxManager.save();
            await fs.writeJson(AUTH_CACHE, profile);
        }

        // Get the Minecraft token
        const token = await xboxManager.getMinecraft();

        // Check if we have a valid token
        if (token.validate()) {
            // Return the mclc-compatible auth object + access_token for APIs
            const authObj = token.mclc();
            authObj.access_token = token.token; // The MSMC token object contains the Minecraft access token
            authObj.profile = token.profile; // Include full profile for skins/UUID etc
            return authObj;
        } else {
            throw new Error('Token validation failed');
        }
    } catch (error) {
        console.error('Microsoft Login Error:', error);
        throw error;
    }
}

module.exports = { loginMicrosoft };
