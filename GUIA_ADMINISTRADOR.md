# 🛠️ Guía del Administrador - Hopper Launcher

Esta guía contiene todo lo que necesitas saber para operar, actualizar y personalizar tu launcher.

---

## 🎨 1. Personalización Estética (Carpeta `assets/`)

Ya no es necesario cambiar el código para personalizar la apariencia básica. Solo coloca los archivos en `assets/` con estos nombres exactos:

| Archivo | Función |
| :--- | :--- |
| **`logo.png`** | Es el **icono oficial** del launcher (.exe, instalador y barra de tareas). |
| **`fondo.png`** | Es la imagen que se verá de **fondo** en todo el launcher. |
| **`instancia1.png`** | Icono para el primer perfil en la barra lateral. |
| **`instancia2.png`** | Icono para el segundo perfil, y así sucesivamente (`instancia3`, `instancia4`...). |

> [!NOTE]
> Los jugadores ya no pueden cambiar el fondo desde los ajustes; tú tienes el control total como administrador desde la carpeta assets.

---

## 🏗️ 2. Crear el Instalador (.exe) para los Jugadores

Cuando estés listo para repartir el launcher:

1.  **Ejecutar compilación**:
    ```powershell
    npm run dist
    ```
2.  **Resultado**: El instalador aparecerá en la carpeta `dist/` como un archivo `.exe`. Este es el archivo que debes subir a los Releases de GitHub.

---

## 🔄 3. Actualización de Mods y Modpacks

Ahora el launcher soporta tanto archivos **.mrpack** (de Modrinth) como una lista de archivos individuales.

### Uso de múltiples .mrpack:
En el archivo `manifest.json`, puedes poner una lista de packs para que se instalen juntos:
```json
"mrpack": [
    "update_files/modpacks/Optimización.mrpack",
    "update_files/modpacks/Contenido.mrpack"
]
```
El launcher procesará ambos, incluyendo las carpetas de configuración (`overrides` y `client-overrides`).

### Limpieza Automática de Seguridad:
Si cambias la versión del juego (`gameVersion`) en el manifest (ej: de 1.20.1 a 1.21.9), el launcher **detectará el cambio y borrará automáticamente la carpeta de mods** del jugador antes de instalar los nuevos. Esto evita que el juego no arranque por mezclar mods incompatibles.

---

## 🗺️ 4. Perfiles Separados por Versión (Instancias)

Si tienes modpacks en versiones diferentes (ej: 1.21.9 y 1.20.1), deben estar en carpetas separadas para no chocar.

### Cómo configurar un perfil aislado:
1.  Crea un nuevo manifiesto (ej: `manifest_horizon.json`).
2.  En `remote_instances.json`, añade el perfil apuntando a ese manifest y define un `gameDir`:
    ```json
    {
        "id": "mi_perfil",
        "name": "Mi Pack Especial",
        "gameDir": "instances/mi_pack",
        "manifestUrl": "https://raw.githubusercontent.com/.../manifest_horizon.json"
    }
    ```
Esto hará que el juego se instale en una subcarpeta, manteniendo sus propios mods y opciones sin tocar los de los demás perfiles.

---

## 🔄 5. Sincronizar Cambios con GitHub

Cada vez que cambies una imagen en `assets/`, un manifest o un perfil en `remote_instances.json`, debes subirlo para que los jugadores lo reciban:

```powershell
git add .
git commit -m "Descripción de tus cambios (ej: Actualizado logo y mods)"
git push origin master
```

---

## 🛠️ 6. Solución de Problemas Comunes

### "Incompatible mods found!"
- **Causa**: Se están mezclando mods de versiones distintas.
- **Solución**: Asegúrate de que cada versión de Minecraft tenga su propio `gameDir` en `remote_instances.json`.

### "No veo mi nueva imagen de fondo"
- **Causa**: El nombre debe ser exactamente `fondo.png` y estar en `assets/`.
- **Solución**: Verifica el nombre y reinicia el launcher.

---

## 🔑 7. Publicar Nueva Versión del Código
Si haces cambios en el diseño visual (CSS, HTML) o en el funcionamiento del launcher:
1. Sube la versión en `package.json`.
2. Ejecuta `npm run dist`.
3. Sube el `.exe` a GitHub Releases. El AutoUpdater avisará a todos los jugadores.
