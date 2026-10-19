import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { MigrationInterface, QueryRunner } from 'typeorm';

// Garantit la compatibilité des anciennes bases créées avant les vidéos.
// Le patch 003 est idempotent : les photos et leurs associations sont conservées.
export class LegacyVehicleMediaCompatibility1790856000007 implements MigrationInterface {
  name = 'LegacyVehicleMediaCompatibility1790856000007';

  async up(queryRunner: QueryRunner): Promise<void> {
    const sql = readFileSync(
      join(process.cwd(), 'database', 'patches', '003-vehicle-videos.sql'),
      'utf8',
    );
    await queryRunner.query(sql);
  }

  async down(): Promise<void> {
    throw new Error('Do not remove vehicle media data automatically.');
  }
}
