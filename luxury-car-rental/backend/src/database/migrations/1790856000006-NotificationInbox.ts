import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { MigrationInterface, QueryRunner } from 'typeorm';

// Migration additive : conserve le flux éditorial et toutes les réservations.
export class NotificationInbox1790856000006 implements MigrationInterface {
  name = 'NotificationInbox1790856000006';

  async up(runner: QueryRunner): Promise<void> {
    const sql = readFileSync(join(process.cwd(), 'database', 'patches', '008-private-notifications.sql'), 'utf8');
    await runner.query(sql);
  }

  async down(): Promise<void> {
    throw new Error('Conserver les notifications historiques : annulation manuelle uniquement.');
  }
}
