
import {
    MigrationInterface,
    QueryRunner,
} from 'typeorm';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export class InitialSchema1790856000000
    implements MigrationInterface {
    name = 'InitialSchema1790856000000';

    public async up(
        queryRunner: QueryRunner,
    ): Promise<void> {
        const schemaPath = join(
            process.cwd(),
            'database',
            'schema.sql',
        );

        const sql = readFileSync(schemaPath, 'utf8');

        await queryRunner.query(sql);
    }

    public async down(
        _queryRunner: QueryRunner,
    ): Promise<void> {
        throw new Error(
            'Initial schema rollback requires a reviewed migration.',
        );
    }
}
