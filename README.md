# OmbiCraft Launcher

Un launcher personalizado para servidores de Minecraft con actualizaciones automáticas, soporte para cuentas autenticas y gestión de mods.

## Características
- 🔄 **Auto-actualización de Mods/Configs**: Sincroniza automáticamente los archivos del cliente con tu servidor.
- 🚀 **Auto-actualización del Launcher**: Se actualiza a sí mismo usando GitHub Releases.
- 🔑 **Login de Microsoft**: Soporte nativo para cuentas autenticas.
- ⚙️ **Configuración**: Selector de RAM y opciones de lanzamiento.
- 🛠️ **Modo Desarrollador**: Logs detallados en `logs/console.log` y herramientas de depuración.
- 🔄 **Resiliencia**: Botón de reintento automático en caso de fallos de actualización.

## Instalación (Desarrollo)

1.  Clonar el repositorio.
2.  Instalar dependencias:
    ```bash
    npm install
    ```
3.  Iniciar en modo desarrollo:
    ```bash
    npm start
    ```

## Publicar Actualizaciones

### Actualizar Contenido (Mods/Configs)
Para actualizar los archivos del juego sin cambiar la versión del launcher:
```bash
node update_server.js
```

### Actualizar el Launcher (Nueva Versión)
Para lanzar una nueva versión del ejecutable (`.exe`):
```bash
node release.js
```
Este script automatiza el versionado, compilación y creación de la Release en GitHub.

## Documentación

Para una guía detallada sobre cómo configurar y desplegar actualizaciones, visita la [Wiki del Proyecto](https://github.com/Antaneyes/minecraft-launcher-custom/wiki/Gu%C3%ADa-de-Configuraci%C3%B3n-y-Despliegue).
