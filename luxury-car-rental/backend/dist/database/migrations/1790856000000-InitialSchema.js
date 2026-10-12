import { readFileSync } from 'node:fs';
import { join } from 'node:path';
export class InitialSchema1790856000000 {
    async up(queryRunner) {
        const schemaPath = join(process.cwd(), 'database', 'schema.sql');
        const sql = readFileSync(schemaPath, 'utf8');
        await queryRunner.query(sql);
    }
    async down(_queryRunner) {
        throw new Error('Initial schema rollback requires a reviewed migration.');
    }
    constructor(){
        this.name = 'InitialSchema1790856000000';
    }
}

//# sourceMappingURL=1790856000000-InitialSchema.js.map