import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';
import dotenv from 'dotenv';

// ==========================================================
// BASE DE DONNÉES JETABLE POUR LES TESTS D'INTÉGRATION
// ==========================================================
//
// Mutualise la création d'une base préfixée `luxury_car_rental_*_itest`,
// l'application du schéma réel (`schema.sql` + tous les patches) et les
// clients `pg`. La base de développement n'est jamais touchée.

dotenv.config();

const BACKEND_ROOT = join(__dirname, '..', '..');
const SCHEMA_FILE = join(BACKEND_ROOT, 'database', 'schema.sql');
const PATCH_DIR = join(BACKEND_ROOT, 'database', 'patches');

const DB_HOST = process.env.DB_HOST ?? 'localhost';
const DB_PORT = Number(process.env.DB_PORT ?? 5432);
const DB_USER = process.env.DB_USERNAME ?? 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD ?? '';

export function itestClient(database: string): Client {
  return new Client({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database,
  });
}

export interface DisposableDatabase {
  name: string;
  /** Client connecté à la base jetable (schéma déjà appliqué). */
  db: Client;
  /** Client connecté à `postgres` (supervision). */
  admin: Client;
}

// Recrée la base puis applique le schéma réel et ses patches.
export async function openDisposableDatabase(
  name: string,
): Promise<DisposableDatabase> {
  const admin = itestClient('postgres');
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${name}`);

  const db = itestClient(name);
  await db.connect();

  await db.query(readFileSync(SCHEMA_FILE, 'utf8'));

  const patches = readdirSync(PATCH_DIR)
    .filter((entry) => entry.endsWith('.sql'))
    .sort();

  for (const patch of patches) {
    await db.query(readFileSync(join(PATCH_DIR, patch), 'utf8'));
  }

  return { name, db, admin };
}

export async function closeDisposableDatabase(
  handle: DisposableDatabase,
): Promise<void> {
  await handle.db.end();
  await handle.admin.end();
}
