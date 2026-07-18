const JavaManager = require('../utils/JavaManager');
const path = require('path');
const fs = require('fs-extra');

const mockSender = {
    send: (channel, msg) => console.log(`[IPC ${channel}] ${msg}`)
};

async function testJavaManager() {
    console.log('Iniciando prueba de JavaManager...');
    const manager = new JavaManager(mockSender);

    // Force download by removing existing if present (optional, maybe just check if it works)
    // const javaDir = path.join(__dirname, '..', 'runtime', 'java21');
    // await fs.remove(javaDir);

    try {
        const javaPath = await manager.ensureJava();
        console.log(`\n✅ ÉXITO: Java detectado/instalado en: ${javaPath}`);

        if (await fs.pathExists(javaPath)) {
            console.log('✅ El archivo realmente existe.');
        } else {
            console.error('❌ El archivo NO existe físicamente.');
        }

    } catch (error) {
        console.error('\n❌ ERROR:', error);
    }
}

testJavaManager();
