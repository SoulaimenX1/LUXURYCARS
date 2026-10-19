// Répare UNIQUEMENT les liens photo manquants des véhicules LC-0001, etc.
// Mode par défaut : diagnostic en lecture seule.
// Mode écriture : node scripts/repair-missing-vehicle-photos.mjs --apply
// IMPORTANT : sauvegarder PostgreSQL avant toute écriture.

import 'dotenv/config';
import pg from 'pg';
import { readdir, access } from 'node:fs/promises';
import { resolve, join, basename } from 'node:path';

const dir = resolve(process.cwd(), '..', 'frontend', 'public', 'vehicles');
const apply = process.argv.includes('--apply');
const required = ['DB_HOST', 'DB_DATABASE', 'DB_USERNAME', 'DB_PASSWORD'];
if (required.some((key) => !process.env[key])) {
  console.error('Configuration PostgreSQL manquante dans backend/.env.');
  process.exit(1);
}

const photos = (await readdir(dir)).filter((name) => /\.(png|jpg|jpeg|webp|avif|gif)$/i.test(name));
const plateToFile = new Map();
for (const name of photos.sort((a, b) => b.localeCompare(a))) {
  const matched = /^(lc-\d{4})-(?:image-)?\d+\.(?:png|jpe?g|webp|avif|gif)$/i.exec(name);
  if (matched && !plateToFile.has(matched[1].toUpperCase())) {
    plateToFile.set(matched[1].toUpperCase(), name);
  }
}

const client = new pg.Client({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 5432),
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
});
await client.connect();
try {
  const { rows } = await client.query(`
    SELECT v.id, v.license_plate, vi.id AS media_id, vi.storage_path
    FROM vehicles v
    LEFT JOIN vehicle_images vi
      ON vi.vehicle_id = v.id AND vi.media_type = 'image' AND vi.is_primary = true
    ORDER BY v.license_plate
  `);
  const toRepair = [];
  let valid = 0;
  for (const row of rows) {
    const localFile = plateToFile.get(row.license_plate?.toUpperCase());
    if (!localFile) continue;
    if (row.storage_path) {
      if (!row.storage_path.startsWith('/vehicles/')) { valid += 1; continue; }
      try { await access(join(dir, basename(row.storage_path))); valid += 1; continue; }
      catch { /* Le lien actuel vise un ancien fichier absent. */ }
    }
    toRepair.push({ ...row, photo: `/vehicles/${localFile}` });
  }
  console.log(`Photos trouvées : ${photos.length} ; associations déjà valides : ${valid} ; à réparer : ${toRepair.length}`);
  for (const row of toRepair) console.log(`${row.license_plate}: ${row.storage_path ?? '(aucune)'} -> ${row.photo}`);
  if (!apply) {
    console.log('Mode lecture seule. Sauvegardez PostgreSQL puis relancez avec --apply pour appliquer.');
  } else if (toRepair.length > 0) {
    await client.query('BEGIN');
    try {
      for (const row of toRepair) {
        if (row.media_id) {
          await client.query(`UPDATE vehicle_images SET storage_path=$2 WHERE id=$1`, [row.media_id, row.photo]);
        } else {
          // Les autres photos restent intactes ; on choisit une principale si nécessaire.
          const { rows: existing } = await client.query(`
            SELECT id FROM vehicle_images
            WHERE vehicle_id=$1 AND media_type='image'
            ORDER BY sort_order,created_at LIMIT 1 FOR UPDATE
          `, [row.id]);
          if (existing.length) {
            await client.query(`UPDATE vehicle_images SET storage_path=$2,is_primary=true WHERE id=$1`, [existing[0].id, row.photo]);
          } else {
            await client.query(`INSERT INTO vehicle_images (vehicle_id,media_type,storage_path,alt_text,is_primary)
              VALUES ($1,'image',$2,$3,true)`, [row.id, row.photo, `Vehicle ${row.license_plate}`]);
          }
        }
      }
      await client.query('COMMIT');
      console.log(`✓ ${toRepair.length} associations réparées sans suppression de médias.`);
    } catch (error) { await client.query('ROLLBACK'); throw error; }
  }
} catch (error) {
  console.error(`Erreur : ${error.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
