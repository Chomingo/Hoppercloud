# 🛠️ Guía del Administrador - Hopper Launcher

Esta guía contiene todo lo que necesitas saber para operar, actualizar y personalizar tu launcher.

---

## 🚀 1. Cómo Iniciar el Launcher (Modo Desarrollo)

Si quieres probar cambios antes de mandárselos a los jugadores, usa estos comandos:

1.  **Abrir Terminal**: En la carpeta del proyecto.
2.  **Iniciar**:
    ```powershell
    npm start
    ```
    *Nota: En este modo, el auto-updater del launcher estará desactivado para no interferir con tu trabajo.*

---

## 🏗️ 2. Crear el Instalador (.exe) para los Jugadores

Cuando estés listo para repartir el launcher a tus amigos o comunidad:

1.  **Ejecutar compilación**:
    ```powershell
    npm run dist
    ```
2.  **Resultado**: El archivo `.exe` aparecerá en la carpeta `dist/`. Ese es el archivo que debes compartir.

---

## 🔄 3. Actualizar un Modpack (Subir Mods)

Como ahora usas un sistema de **ramas**, el proceso depende de qué perfil quieras actualizar.

### Paso a paso para actualizar un perfil (ej: Rama `dev`):

1.  **Entrar en la rama**:
    ```powershell
    git checkout dev
    ```
2.  **Gestión de Archivos**:
    - Ve a la carpeta `update_files/mods/`.
    - Añade los nuevos mods o borra los que ya no quieras.
3.  **Actualizar el Registro (Manifest)**:
    ```powershell
    node generate_manifest.js
    ```
4.  **Sincronizar con GitHub**:
    ```powershell
    git add .
    git commit -m "Actualizados mods del perfil dev"
    git push origin dev
    ```

> [!TIP]
> **Ramas Disponibles:**
> - `master`: Perfil Principal
> - `adventure-branch`: Perfil Aventura
> - `tech-dev`: Perfil Técnico
> - `dev`: Perfil Beta / Desarrollo

---

## 📱 4. Gestión Dinámica de Perfiles (Barra Lateral)

Ya no necesitas crear un `.exe` nuevo para quitar o poner iconos en la barra lateral. Todo se controla desde el archivo **`remote_instances.json`**.

### Cómo añadir o quitar un perfil:
1.  Asegúrate de estar en la rama `master` (`git checkout master`).
2.  Abre `remote_instances.json`.
3.  Modifica la lista (puedes cambiar `enabled: true` por `false` para ocultar un perfil).
4.  Sube el cambio:
    ```powershell
    git add remote_instances.json
    git commit -m "Cambio en la lista de perfiles"
    git push origin master
    ```

---

## 🛠️ 5. Solución de Problemas Comunes

### "El launcher se cierra al iniciar Minecraft"
- **Causa**: Casi siempre es un mod incompatible o que le falta una dependencia.
- **Solución**: Revisa la consola del launcher (icono superior derecho `>_`). Te dirá qué mod está fallando. Elimínalo de `update_files/mods`, genera el manifest y haz push.

### "No veo los cambios en el launcher"
- **Causa**: El launcher tiene una caché local.
- **Solución**: Cierra y vuelve a abrir el launcher. Si persiste, despliega la consola y verifica que el enlace a GitHub (`remote_instances.json`) no tenga errores 404.

---

## 🔑 6. Publicar Nueva Versión del Launcher
Si haces cambios en el código visual (CSS, HTML) o funciones nuevas:
```powershell
npm run dist
```
Luego sube el nuevo `.exe` a tu sección de **Releases** en GitHub para que el AutoUpdater avise a todos los jugadores.
