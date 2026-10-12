export function createDatabaseConfig(config) {
    return {
        // Database type
        type: 'postgres',
        // Database connection
        host: config.getOrThrow('DB_HOST'),
        port: config.getOrThrow('DB_PORT'),
        username: config.getOrThrow('DB_USERNAME'),
        password: config.getOrThrow('DB_PASSWORD'),
        database: config.getOrThrow('DB_DATABASE'),
        // Load entities registered by NestJS modules
        autoLoadEntities: true,
        // Database changes are managed by migrations
        synchronize: false,
        // Do not execute migrations automatically
        migrationsRun: false,
        // Database logging
        logging: config.get('NODE_ENV') === 'development' ? [
            'error',
            'warn'
        ] : [
            'error'
        ]
    };
}

//# sourceMappingURL=database.config.js.map