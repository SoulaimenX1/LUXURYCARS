// ============================================================
// Applique un patch SQL idempotent à la base PostgreSQL.
//
// Utilisation (depuis le dossier backend/) :
//   node scripts/apply-patch.mjs
//   node scripts/apply-patch.mjs database/patches/002-....sql
//
// Le fichier SQL est exécuté dans une transaction : en cas
// d'erreur, aucune modification n'est conservée.
// ============================================================

import 'dotenv/config';

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

const { Client } = pg;

const currentDir = dirname(fileURLToPath(import.meta.url));

const defaultPatch = join(
  currentDir,
  '..',
  'database',
  'patches',
  '002-editions-and-notifications.sql',
);

const patchPath = resolve(process.argv[2] ?? defaultPatch);

// ------------------------------------------------------------
// 1. VÉRIFIER L'ENVIRONNEMENT
// ------------------------------------------------------------

for (const key of [
  'DB_HOST',
  'DB_USERNAME',
  'DB_PASSWORD',
  'DB_DATABASE',
]) {
  if (!process.env[key]) {
    console.error(`✗ Variable manquante : ${key}.`);
    console.error(
      '  Lancez la commande depuis le dossier backend/ pour que dotenv lise .env.',
    );
    process.exit(1);
  }
}

// ------------------------------------------------------------
// 2. LIRE LE FICHIER SQL
// ------------------------------------------------------------

let sql;

try {
  sql = readFileSync(patchPath, 'utf8');
} catch {
  console.error(`✗ Fichier introuvable : ${patchPath}`);
  process.exit(1);
}

// ------------------------------------------------------------
// 3. EXÉCUTER
// ------------------------------------------------------------

const client = new Client({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 5432),
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
});

await client.connect();

console.log(
  `→ Connecté à ${process.env.DB_DATABASE} sur ${process.env.DB_HOST}`,
);
console.log(`→ Application du patch : ${patchPath}`);

try {
  await client.query('BEGIN');
  await client.query(sql);
  await client.query('COMMIT');
  console.log('✓ Patch appliqué avec succès.');
} catch (error) {
  await client.query('ROLLBACK');
  console.error('✗ Échec du patch :', error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
