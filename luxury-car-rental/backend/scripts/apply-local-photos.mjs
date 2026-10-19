// ============================================================
// PHOTOS DÉTOURÉES LOCALES
// ============================================================
//
// Pointe la photo principale de chaque véhicule vers le PNG
// détouré (fond transparent) stocké dans
// `frontend/public/vehicles/<slug>.png`.
//
// Les fichiers sont produits hors ligne par le pipeline de
// suppression d'arrière-plan ; ce script ne fait que relier la
// base aux fichiers présents.
//
//   node scripts/apply-local-photos.mjs
//
// Idempotent : relancer le script ne change rien si la base est
// déjà à jour. Les véhicules sans fichier local conservent leur
// photo existante.
// ============================================================

import 'dotenv/config';

import pg from 'pg';

import { localPhotoFor } from './lib/vehicle-images.mjs';

const { Client } = pg;

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

try {
  const { rows } = await client.query(
    `SELECT
        vehicle.id,
        brand.name AS brand,
        model.name AS model
     FROM vehicles vehicle
     JOIN vehicle_models model ON model.id = vehicle.model_id
     JOIN brands brand ON brand.id = model.brand_id
     ORDER BY brand.name, model.name`,
  );

  let updated = 0;
  let inserted = 0;
  let missing = 0;

  await client.query('BEGIN');

  for (const row of rows) {
    const storagePath = await localPhotoFor(row.brand, row.model);

    if (!storagePath) {
      missing += 1;
      continue;
    }

    const alt = `${row.brand} ${row.model}`;

    const { rows: existing } = await client.query(
      `SELECT id FROM vehicle_images
        WHERE vehicle_id = $1 AND media_type = 'image'
        ORDER BY is_primary DESC, id ASC
        LIMIT 1`,
      [row.id],
    );

    if (existing.length > 0) {
      await client.query(
        `UPDATE vehicle_images
            SET storage_path = $2, alt_text = $3, is_primary = true
          WHERE id = $1`,
        [existing[0].id, storagePath, alt],
      );
      updated += 1;
    } else {
      await client.query(
        `INSERT INTO vehicle_images
            (vehicle_id, media_type, storage_path, alt_text, is_primary)
         VALUES ($1, 'image', $2, $3, true)`,
        [row.id, storagePath, alt],
      );
      inserted += 1;
    }
  }

  await client.query('COMMIT');

  console.log(
    `  ${updated} mises à jour, ${inserted} créées, ` +
      `${missing} sans photo locale.`,
  );
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  console.error(`✗ Erreur : ${error.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
