module.exports = [
    {
        id: 'default',
        name: 'Principal',
        icon: 'assets/icon.png',
        description: 'Instancia Principal',
        modsDir: 'mods',
        enabled: true,
        manifestUrl: 'https://raw.githubusercontent.com/Chomingo/Hoppercloud/master/manifest.json'
    },
    {
        id: 'instance_2',
        name: 'Modpack Aventura',
        icon: 'assets/icon_adventure.png',
        description: 'Pack de Mods de Aventura',
        modsDir: 'instances/adventure/mods',
        gameDir: 'instances/adventure',
        enabled: true,
        manifestUrl: 'https://raw.githubusercontent.com/Chomingo/Hoppercloud/adventure-branch/manifest.json'
    },
    {
        id: 'instance_3',
        name: 'Modpack Técnico',
        icon: 'assets/icon_tech.png',
        description: 'Pack de Mods Técnicos',
        modsDir: 'instances/tech/mods',
        gameDir: 'instances/tech',
        enabled: true,
        manifestUrl: 'https://raw.githubusercontent.com/Chomingo/Hoppercloud/tech-dev/manifest.json'
    },
    {
        id: 'instance_dev',
        name: 'Beta / Desarrollo',
        icon: 'assets/icon_dev.png',
        description: 'Prueba las últimas novedades aquí',
        modsDir: 'instances/dev/mods',
        gameDir: 'instances/dev',
        enabled: true,
        manifestUrl: 'https://raw.githubusercontent.com/Chomingo/Hoppercloud/dev/manifest.json'
    },
    {
        id: 'instance_horizon',
        name: 'Horizon Modpack',
        icon: 'assets/icon.png',
        description: 'Pack de Mods Horizon (v1.20.1)',
        modsDir: 'instances/horizon/mods',
        gameDir: 'instances/horizon',
        enabled: true,
        manifestUrl: 'https://raw.githubusercontent.com/Chomingo/Hoppercloud/master/manifest_horizon.json'
    }
];
