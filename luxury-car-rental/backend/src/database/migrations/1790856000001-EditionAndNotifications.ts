
import {
    MigrationInterface,
    QueryRunner,
} from 'typeorm';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Cette migration applique un patch idempotent :
// caractéristiques éditoriales, marqueurs d'édition et
// table notifications. Relancer la migration ne casse rien.
export class EditionAndNotifications1790856000001
    implements MigrationInterface {
    name = 'EditionAndNotifications1790856000001';

    public async up(
        queryRunner: QueryRunner,
    ): Promise<void> {
        const patchPath = join(
            process.cwd(),
            'database',
            'patches',
            '002-editions-and-notifications.sql',
        );

        const sql = readFileSync(patchPath, 'utf8');

        await queryRunner.query(sql);
    }

    public async down(
        _queryRunner: QueryRunner,
    ): Promise<void> {
        throw new Error(
            'Edition and notifications rollback requires a reviewed migration.',
        );
    }
}
