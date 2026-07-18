# Safioland Launcher

launcher personalizado para servidores de Minecraft, soporte para cuentas premium y gestión de modpacks

## Características
- **Auto-actualización de Mods/Configs**: los archivos se actualizando automáticamente descargando nuevos mods desde el repositorio que selecciones 
-  **Auto-actualización del Launcher**: Se actualiza a sí mismo usando GitHub Releases.
- **Login de Microsoft**: Soporte para cuentas premium de minecraft
- **Configuración**: Selector de RAM y opciones de Optimización antes de lanzar.
-  **Modo Desarrollador**: Logs detallados en `logs/console.log`.

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

### Actualizar (Modpacks/Configs)
Para actualizar los archivos del juego sin cambiar la versión del launcher:
```bash
node update_server.js
```

### Actualizar el Launcher (Nueva Versión)
Para lanzar una nueva versión del launcher (`.exe`):
```bash
node release.js
```

## Documentación

- [📘 Guía del Administrador (Comandos y Actualizaciones)](GUIA_ADMINISTRADOR.md)
- [📜 Instrucciones rápidas para Modpacks](INSTRUCCIONES_MODPACKS.txt)
