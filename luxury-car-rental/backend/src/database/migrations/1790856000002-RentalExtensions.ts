import { MigrationInterface, QueryRunner } from 'typeorm';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Appliquer le schéma d'historisation sur les bases déjà créées.
export class RentalExtensions1790856000002 implements MigrationInterface {
  name = 'RentalExtensions1790856000002';

  async up(queryRunner: QueryRunner): Promise<void> {
    const sql = readFileSync(
      join(process.cwd(), 'database', 'patches', '004-rental-extensions.sql'),
      'utf8',
    );
    await queryRunner.query(sql);
  }

  async down(_queryRunner: QueryRunner): Promise<void> {
    throw new Error('Removing rental extension history requires manual review.');
  }
}
