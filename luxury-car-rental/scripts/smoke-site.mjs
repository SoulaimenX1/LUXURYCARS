// Test HTTP en lecture seule : diagnostic des deux serveurs locaux et des médias.
// À lancer APRÈS démarrage de NestJS et Next.js : node scripts/smoke-site.mjs
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const frontend = process.env.SITE_URL ?? 'http://localhost:3000';
const backend = process.env.BACKEND_URL ?? 'http://localhost:3001';
const entries = [];
async function get(label, url, validate) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10000), cache: 'no-store' });
    const data = await response.text();
    let message = `HTTP ${response.status}`;
    let ok = response.ok;
    if (response.ok && validate) {
      try { const outcome = validate(response, data); ok = Boolean(outcome); if (!ok) message += ' format invalide'; }
      catch (error) { ok = false; message += ` ${error.message}`; }
    }
    entries.push({ label, ok, message });
    return { ok, response, data };
  } catch (error) {
    entries.push({ label, ok: false, message: error.message });
    return { ok: false };
  }
}

await get('API /health', `${backend}/health`, (_, body) => JSON.parse(body).status !== undefined);
await get('Page accueil', `${frontend}/`, (response, body) => response.headers.get('content-type')?.includes('text/html') && body.length > 50);
const catalog = await get('Catalogue public', `${frontend}/api/vehicles/catalog`, (_, body) => Array.isArray(JSON.parse(body)));
if (catalog.ok) {
  const vehicles = JSON.parse(catalog.data);
  console.log(`Catalogue : ${vehicles.length} véhicules renvoyés par PostgreSQL.`);
  if (vehicles.length) {
    const withPictures = vehicles.filter(vehicle => vehicle.imageUrl);
    entries.push({ label: 'Liens photos en catalogue', ok: withPictures.length > 0, message: `${withPictures.length}/${vehicles.length} véhicules avec imageUrl` });
    for (const vehicle of withPictures.slice(0, 5)) {
      const url = new URL(vehicle.imageUrl, frontend);
      if (url.origin === new URL(frontend).origin) {
        await get(`Photo ${vehicle.brandName} ${vehicle.modelName}`, url.href, (res) => res.headers.get('content-type')?.startsWith('image/'));
      }
    }
  }
}
const dates = [7, 10].map(days => { const date = new Date(); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); });
await get('Recherche disponibilité', `${frontend}/api/vehicles/available?from=${dates[0]}&to=${dates[1]}`, (_, body) => Array.isArray(JSON.parse(body)));
const media = (await readdir(join(root, 'frontend', 'public', 'vehicles'))).filter(name => /\.(png|jpe?g|webp)$/i.test(name));
entries.push({ label: 'Fichiers de photos sur disque', ok: media.length > 0, message: `${media.length} images` });
console.log('\nDiagnostic HTTP (lecture seule) :');
for (const entry of entries) console.log(`${entry.ok ? 'OK ' : 'FAIL'} ${entry.label} — ${entry.message}`);
console.log('\nCe test ne vérifie pas les connexions, réservations, paiements ni permissions. Ces parcours doivent être validés avec Postman et deux comptes de test.');
if (entries.some(entry => !entry.ok)) process.exitCode = 1;
