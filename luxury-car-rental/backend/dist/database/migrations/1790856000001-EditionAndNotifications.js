import { readFileSync } from 'node:fs';
import { join } from 'node:path';
// Cette migration applique un patch idempotent :
// caractéristiques éditoriales, marqueurs d'édition et
// table notifications. Relancer la migration ne casse rien.
export class EditionAndNotifications1790856000001 {
    async up(queryRunner) {
        const patchPath = join(process.cwd(), 'database', 'patches', '002-editions-and-notifications.sql');
        const sql = readFileSync(patchPath, 'utf8');
        await queryRunner.query(sql);
    }
    async down(_queryRunner) {
        throw new Error('Edition and notifications rollback requires a reviewed migration.');
    }
    constructor(){
        this.name = 'EditionAndNotifications1790856000001';
    }
}

//# sourceMappingURL=1790856000001-EditionAndNotifications.js.map