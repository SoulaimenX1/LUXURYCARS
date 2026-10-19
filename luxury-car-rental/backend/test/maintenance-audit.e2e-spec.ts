import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';
import type { DataSource } from 'typeorm';
import dotenv from 'dotenv';

import { ReservationsAdminService } from '../src/reservations/reservations-admin.service.js';

// ==========================================================
// ISSUE 08 — REPRODUCTIBILITÉ DE LA MIGRATION 018
// JOURNAL D'AUDIT DE LIBÉRATION DES BLOCS DE MAINTENANCE
// ==========================================================
//
// Ces tests s'exécutent contre une base PostgreSQL JETABLE créée
// à partir du schéma réel (schema.sql) puis de TOUS les patches
// numérotés, appliqués dans l'ordre trié — exactement la procédure
// d'installation documentée. Ils prouvent qu'une installation
// neuve crée bien `vehicle_unavailability_audit` et ses index, que
// la libération d'un bloc reste NON DESTRUCTIVE et transactionnelle,
// que l'historique ne peut jamais être dupliqué, et que les
// contraintes d'exclusion existantes sont préservées.

dotenv.config();

const DB_HOST = process.env.DB_HOST ?? 'localhost';
const DB_PORT = Number(process.env.DB_PORT ?? 5432);
const DB_USER = process.env.DB_USERNAME ?? 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD ?? '';
const TEST_DB = 'luxury_car_rental_maintenance_itest';

const BACKEND_ROOT = join(__dirname, '..');
const SCHEMA_FILE = join(BACKEND_ROOT, 'database', 'schema.sql');
const PATCH_DIR = join(BACKEND_ROOT, 'database', 'patches');

const ID = {
  staffUser: '10000000-0000-4000-8000-000000000001',
  brand: '20000000-0000-4000-8000-000000000001',
  category: '30000000-0000-4000-8000-000000000001',
  model: '40000000-0000-4000-8000-000000000001',
  vehicle: '50000000-0000-4000-8000-000000000001',
};

let admin: Client;
let db: Client;
let service: ReservationsAdminService;

function clientFor(database: string): Client {
  return new Client({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database,
  });
}

// Adaptateur réel : `releaseUnavailability` n'utilise que
// `dataSource.transaction` + `manager.query`. Chaque transaction
// ouvre une connexion dédiée (BEGIN/COMMIT/ROLLBACK), comme le
// ferait un pool — indispensable pour tester le rollback.
function makeTransactionalDataSource(database: string): DataSource {
  return {
    query: async (text: string, params: unknown[] = []) => {
      const client = clientFor(database);
      await client.connect();
      try {
        return (await client.query(text, params)).rows;
      } finally {
        await client.end();
      }
    },
    transaction: async (
      cb: (manager: {
        query: (text: string, params?: unknown[]) => Promise<unknown>;
      }) => Promise<unknown>,
    ) => {
      const client = clientFor(database);
      await client.connect();
      try {
        await client.query('BEGIN');
        const manager = {
          query: (text: string, params: unknown[] = []) =>
            client.query(text, params).then((result) => result.rows),
        };
        const result = await cb(manager);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        await client.end();
      }
    },
  } as unknown as DataSource;
}

async function applyBaseline(target: Client) {
  await target.query(readFileSync(SCHEMA_FILE, 'utf8'));
  const patches = readdirSync(PATCH_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort();
  for (const patch of patches) {
    await target.query(readFileSync(join(PATCH_DIR, patch), 'utf8'));
  }
}

async function seed(target: Client) {
  await target.query(
    `INSERT INTO users (id, email, password_hash, role, first_name, last_name)
     VALUES ($1, 'itest.audit.staff@example.com', 'x', 'staff', 'Audit', 'Staff')`,
    [ID.staffUser],
  );
  await target.query(`INSERT INTO brands (id, name) VALUES ($1, 'Audit Motors')`, [ID.brand]);
  await target.query(`INSERT INTO categories (id, name) VALUES ($1, 'Audit Class')`, [ID.category]);
  await target.query(
    `INSERT INTO vehicle_models (id, brand_id, category_id, name) VALUES ($1, $2, $3, 'Audit One')`,
    [ID.model, ID.brand, ID.category],
  );
  await target.query(
    `INSERT INTO vehicles
       (id, model_id, manufacture_year, license_plate, vin, transmission, fuel_type,
        daily_price, security_deposit, vehicle_value, status)
     VALUES ($1, $2, 2024, 'AUDIT-01', 'VIN0000000000AU01', 'automatic', 'petrol',
             300.00, 2500.00, 200000.00, 'active')`,
    [ID.vehicle, ID.model],
  );
}

async function insertBlock(
  target: Client,
  from: string,
  to: string,
  notes: string | null = null,
): Promise<{ id: string }> {
  const row = await target.query<{ id: string }>(
    `INSERT INTO vehicle_unavailability (vehicle_id, starts_at, ends_at, reason, notes, created_by)
     VALUES ($1, $2, $3, 'maintenance', $4, $5)
     RETURNING id`,
    [ID.vehicle, from, to, notes, ID.staffUser],
  );
  return row.rows[0];
}

describe('Issue 08 — journal d’audit de maintenance (PostgreSQL réel)', () => {
  beforeAll(async () => {
    admin = clientFor('postgres');
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE)`);
    await admin.query(`CREATE DATABASE ${TEST_DB}`);

    db = clientFor(TEST_DB);
    await db.connect();
    await applyBaseline(db);
    await seed(db);

    service = new ReservationsAdminService(
      {} as never,
      makeTransactionalDataSource(TEST_DB),
      {} as never,
      {} as never,
    );
  }, 180_000);

  afterAll(async () => {
    await db?.end();
    await admin?.end();
  });

  beforeEach(async () => {
    await db.query('TRUNCATE vehicle_unavailability, vehicle_unavailability_audit');
  });

  it('la table d’audit existe après application du schéma et des patches', async () => {
    const rows = await db.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'vehicle_unavailability_audit'`,
    );
    expect(rows.rows.length).toBe(1);
  });

  it('l’index unique garantit une seule trace par bloc', async () => {
    const rows = await db.query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes
        WHERE tablename = 'vehicle_unavailability_audit'
          AND indexname = 'uq_unavail_audit_unavailability'`,
    );
    expect(rows.rows.length).toBe(1);
  });

  it('libère un bloc en recopiant sa trace puis le retire (non destructif)', async () => {
    const block = await insertBlock(db, '2035-07-01T08:00:00Z', '2035-07-03T08:00:00Z', 'Oil change');

    const result = await service.releaseUnavailability(block.id, ID.staffUser, 'Completed');
    expect(result.released).toBe(1);

    const audit = await db.query<{
      unavailability_id: string;
      notes: string | null;
      release_reason: string | null;
    }>(
      `SELECT unavailability_id, notes, release_reason
         FROM vehicle_unavailability_audit WHERE unavailability_id = $1`,
      [block.id],
    );
    expect(audit.rows.length).toBe(1);
    expect(audit.rows[0].notes).toBe('Oil change');
    expect(audit.rows[0].release_reason).toBe('Completed');

    const active = await db.query<{ total: string }>(
      `SELECT count(*)::text AS total FROM vehicle_unavailability WHERE id = $1`,
      [block.id],
    );
    expect(active.rows[0].total).toBe('0');
  });

  it('ne crée jamais d’historique en double (unique + ON CONFLICT)', async () => {
    const block = await insertBlock(db, '2035-07-01T08:00:00Z', '2035-07-03T08:00:00Z');
    await service.releaseUnavailability(block.id, ID.staffUser);

    // Une seconde libération échoue : le bloc actif n'existe plus.
    await expect(
      service.releaseUnavailability(block.id, ID.staffUser),
    ).rejects.toThrow();

    const audit = await db.query<{ total: string }>(
      `SELECT count(*)::text AS total FROM vehicle_unavailability_audit WHERE unavailability_id = $1`,
      [block.id],
    );
    expect(audit.rows[0].total).toBe('1');

    // L'index unique refuse directement un doublon inséré à la main.
    const existingVehicle = await db.query<{ vehicle_id: string }>(
      `SELECT vehicle_id FROM vehicle_unavailability_audit WHERE unavailability_id = $1`,
      [block.id],
    );
    await expect(
      db.query(
        `INSERT INTO vehicle_unavailability_audit
           (unavailability_id, vehicle_id, starts_at, ends_at, reason)
         VALUES ($1, $2, now(), now(), 'maintenance')`,
        [block.id, existingVehicle.rows[0].vehicle_id],
      ),
    ).rejects.toThrow();
  });

  it('annule toute la libération si l’insertion d’audit échoue (rollback)', async () => {
    const block = await insertBlock(db, '2035-07-01T08:00:00Z', '2035-07-03T08:00:00Z');

    // Un `released_by` invalide fait échouer l'INSERT d'audit : la
    // transaction doit être annulée et le bloc actif conservé.
    await expect(
      service.releaseUnavailability(block.id, 'not-a-uuid'),
    ).rejects.toThrow();

    const stillActive = await db.query<{ total: string }>(
      `SELECT count(*)::text AS total FROM vehicle_unavailability WHERE id = $1`,
      [block.id],
    );
    expect(stillActive.rows[0].total).toBe('1');

    const audit = await db.query<{ total: string }>(
      `SELECT count(*)::text AS total FROM vehicle_unavailability_audit`,
    );
    expect(audit.rows[0].total).toBe('0');
  });

  it('préserve la contrainte d’exclusion des blocs qui se chevauchent', async () => {
    const constraint = await db.query<{ conname: string }>(
      `SELECT conname FROM pg_constraint
        WHERE conrelid = 'vehicle_unavailability'::regclass
          AND conname = 'ex_unavail_no_overlap'`,
    );
    expect(constraint.rows.length).toBe(1);

    await insertBlock(db, '2035-07-01T08:00:00Z', '2035-07-05T08:00:00Z');
    await expect(
      insertBlock(db, '2035-07-03T08:00:00Z', '2035-07-06T08:00:00Z'),
    ).rejects.toThrow();
  });
});
