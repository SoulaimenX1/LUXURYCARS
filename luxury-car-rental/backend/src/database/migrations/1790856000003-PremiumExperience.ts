import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { MigrationInterface, QueryRunner } from 'typeorm';

// Migration additive : les anciens contrats conservent leurs montants.
export class PremiumExperience1790856000003 implements MigrationInterface {
  name = 'PremiumExperience1790856000003';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(readFileSync(join(process.cwd(), 'database', 'patches', '005-premium-experience.sql'), 'utf8'));
  }
  async down(): Promise<void> {
    throw new Error('La suppression des données client premium nécessite une révision manuelle.');
  }
}
