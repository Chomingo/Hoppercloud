const DiscordRPC = require('discord-rpc');

class DiscordManager {
    constructor() {
        this.clientId = '1454989388063969362'; // ID oficial de Hopper Launcher
        this.rpc = null;
        this.startPos = Date.now();
        this.active = false;
        this.currentStatus = 'En el menú';
        this.currentInstance = null;
    }

    async init() {
        if (this.rpc) {
            console.log('Discord RPC already initialized');
            return;
        }

        console.log('Iniciando Discord RPC con ID:', this.clientId);
        this.rpc = new DiscordRPC.Client({ transport: 'ipc' });

        this.rpc.on('ready', () => {
            console.log('Discord RPC: Conectado y Listo');
            this.active = true;
            this.updateActivity();
        });

        this.rpc.on('error', (err) => {
            console.error('Discord RPC Error:', err);
        });

        this.rpc.login({ clientId: this.clientId }).catch(err => {
            console.warn('Discord RPC: No se pudo conectar (¿Discord abierto?):', err.message);
            this.active = false;
        });
    }

    updateActivity(details = null, state = null) {
        if (!this.rpc) {
            console.log('Discord RPC: updateActivity llamada pero no hay rpc');
            return;
        }
        if (!this.active) {
            console.log('Discord RPC: updateActivity llamada pero no está activo aún');
            return;
        }

        console.log('Discord RPC: Actualizando actividad...', { details, state });

        const activity = {
            details: details || this.currentStatus,
            state: state || (this.currentInstance ? `Jugando: ${this.currentInstance}` : 'A punto de iniciar'),
            startTimestamp: this.startPos,
            largeImageKey: 'icon',
            largeImageText: 'Hopper Launcher',
            instance: true,
        };

        this.rpc.setActivity(activity).catch(err => {
            console.error('Error al actualizar actividad de Discord:', err);
        });
    }

    setMenuStatus() {
        this.currentStatus = 'En el menú';
        this.currentInstance = null;
        this.updateActivity();
    }

    setPlayingStatus(instanceName) {
        this.currentStatus = 'Jugando';
        this.currentInstance = instanceName;
        this.updateActivity();
    }

    clearActivity() {
        if (this.rpc && this.active) {
            this.rpc.clearActivity();
        }
    }
}

module.exports = new DiscordManager();
