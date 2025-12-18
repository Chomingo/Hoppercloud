module.exports = [
    {
        id: 'default',
        name: 'Principal',
        icon: 'assets/icon_default.png',
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
    }
];
