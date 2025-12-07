const { execSync } = require('child_process');
const readline = require('readline');

function run(command) {
    console.log(`\n> ${command}`);
    try {
        execSync(command, { stdio: 'inherit' });
    } catch (e) {
        console.error(`❌ Error ejecutando: ${command}`);
        process.exit(1);
    }
}

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('\n🚀 SCRIPT DE PROMOCIÓN: DEV -> ESTABLE');
console.log('=======================================');
console.log('Este script realizará las siguientes acciones:');
console.log("1. Cambiar a rama 'master' y actualizarla.");
console.log("2. Fusionar todo el contenido de 'dev' en 'master'.");
console.log("3. Ejecutar 'release.js' para crear la versión estable (tag, build, release).");
console.log("4. Volver a 'dev' y fusionar 'master' de vuelta (para sincronizar versiones).");
console.log("5. Subir 'dev' actualizado a la nube.");
console.log('\n⚠️  REQUISITOS:');
console.log('- Debes tener el directorio de trabajo limpio (sin cambios pendientes).');
console.log('- Debes haber probado que "dev" funciona correctamente.');

rl.question('\n¿Deseas continuar? (escribe "si" para confirmar): ', (answer) => {
    if (answer.toLowerCase() !== 'si') {
        console.log('Cancelado por el usuario.');
        process.exit(0);
    }

    try {
        // 1. Checkout Master & Pull
        console.log('\n[1/5] Preparando rama MASTER...');
        run('git checkout master');
        run('git pull origin master');

        // 2. Merge Dev
        console.log('\n[2/5] Fusionando DEV -> MASTER...');
        run('git merge dev');

        // 3. Release
        console.log('\n[3/5] Creando Lanzamiento Estable...');
        // release.js se encarga de bump version, build, commit, push master y gh release
        run('node release.js');

        // 4. Sync Back
        console.log('\n[4/5] Sincronizando vuelta a DEV...');
        run('git checkout dev');
        run('git merge master');

        // 5. Push Dev
        console.log('\n[5/5] Subiendo DEV actualizado...');
        run('git push origin dev');

        console.log('\n✅ ¡PROMOCIÓN COMPLETADA CORRECTAMENTE!');
        console.log("Ahora 'master' tiene la nueva versión estable y 'dev' está lista para el futuro.");
    } catch (e) {
        console.error('\n❌ El proceso falló. Revisa los errores arriba.');
        console.error('Es posible que debas resolver conflictos manualmente o volver a tu rama anterior.');
    } finally {
        rl.close();
    }
});
