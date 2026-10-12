import 'dotenv/config';
import 'reflect-metadata';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DataSource } from 'typeorm';
const currentDir = dirname(fileURLToPath(import.meta.url));
export default new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    entities: [
        join(currentDir, '../**/*.entity.js')
    ],
    migrations: [
        join(currentDir, 'migrations/*.js')
    ],
    migrationsTableName: 'typeorm_migrations',
    synchronize: false,
    migrationsRun: false
});

//# sourceMappingURL=data-source.js.map