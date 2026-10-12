
import { ConfigService } from '@nestjs/config';

import {
    TypeOrmModuleOptions,
} from '@nestjs/typeorm';

export function createDatabaseConfig(
    config: ConfigService,
): TypeOrmModuleOptions {
    return {
        // Database type
        type: 'postgres',

        // Database connection
        host: config.getOrThrow<string>(
            'DB_HOST',
        ),

        port: config.getOrThrow<number>(
            'DB_PORT',
        ),

        username: config.getOrThrow<string>(
            'DB_USERNAME',
        ),

        password: config.getOrThrow<string>(
            'DB_PASSWORD',
        ),

        database: config.getOrThrow<string>(
            'DB_DATABASE',
        ),

        // Load entities registered by NestJS modules
        autoLoadEntities: true,

        // Database changes are managed by migrations
        synchronize: false,

        // Do not execute migrations automatically
        migrationsRun: false,

        // Database logging
        logging:
            config.get<string>('NODE_ENV') ===
                'development'
                ? ['error', 'warn']
                : ['error'],
    };
}
