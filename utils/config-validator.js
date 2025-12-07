const config = require('../launcher_builder_config.json');

function validateConfig() {
    const requiredFields = [
        'gameVersion',
        'fabricLoaderVersion',
        'repoUser',
        'repoName',
        'branch'
    ];

    const missing = requiredFields.filter(field => !config[field]);

    if (missing.length > 0) {
        console.error('\n❌ Configuration Error: Missing required fields in launcher_builder_config.json');
        missing.forEach(field => console.error(`   - ${field}`));
        process.exit(1);
    }

    // Type checks
    const stringFields = requiredFields;
    const invalidTypes = stringFields.filter(field => typeof config[field] !== 'string');

    if (invalidTypes.length > 0) {
        console.error('\n❌ Configuration Error: Invalid field types in launcher_builder_config.json (must be strings)');
        invalidTypes.forEach(field => console.error(`   - ${field}: ${typeof config[field]}`));
        process.exit(1);
    }

    console.log('✅ Configuration valid.');
}

module.exports = { validateConfig };
