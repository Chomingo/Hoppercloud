const axios = require('axios');
const fs = require('fs');
const path = require('path');

const urls = [
    'https://unpkg.com/skinview3d@2.4.0/dist/bundle.js',
    'https://cdn.jsdelivr.net/npm/skinview3d@2.4.0/dist/bundle.js',
    'https://unpkg.com/skinview3d@2.0.0/dist/bundle.js'
];

async function download() {
    for (const url of urls) {
        console.log(`Intentando descargar desde ${url}...`);
        try {
            const response = await axios({
                url,
                method: 'GET',
                timeout: 10000
            });

            if (response.data && response.data.length > 1000) {
                const filePath = path.join(__dirname, 'ui', 'skinview3d.js');
                fs.writeFileSync(filePath, response.data);
                console.log(`¡Éxito! Descargado de ${url}. Tamaño: ${response.data.length} bytes.`);
                return;
            } else {
                console.log(`Respuesta inválida o demasiado corta de ${url}.`);
            }
        } catch (err) {
            console.log(`Fallo en ${url}: ${err.message}`);
        }
    }
    console.error('No se pudo descargar la librería de ninguna fuente.');
    process.exit(1);
}

download();
