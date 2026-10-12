// ============================================================
// PHOTOS RÉELLES DU CATALOGUE
// ============================================================
//
// Remplit la table `vehicle_images` avec une photo réelle pour
// chaque véhicule (source : API publique de Wikipédia).
//
// À exécuter après `seed-luxury-catalog.mjs` :
//
//   node scripts/seed-vehicle-images.mjs
//
// Le script est idempotent : les images existantes sont
// remplacées.
// ============================================================

import 'dotenv/config';

import pg from 'pg';

import { populateVehicleImages } from './lib/vehicle-images.mjs';

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
  console.log('→ Récupération des photos réelles...');

  const result = await populateVehicleImages(client);

  console.log(`  ${result.withImage}/${result.total} photos enregistrées.`);
} catch (error) {
  console.error(`✗ Erreur pendant le seed : ${error.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
