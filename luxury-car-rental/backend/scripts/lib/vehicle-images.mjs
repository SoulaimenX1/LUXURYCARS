// ============================================================
// PHOTOS RÉELLES DES VÉHICULES
// ============================================================
//
// Résout une photo réelle pour chaque modèle du catalogue à
// partir de l'API publique de Wikipédia (Wikimédia Commons),
// puis remplit la table `vehicle_images`.
//
// Les images renvoyées par l'API sont des vignettes Commons
// (licences libres) directement affichables dans un <img>.
//
// La résolution est « best effort » : si aucune image n'est
// trouvée pour un modèle, le véhicule n'aura simplement pas
// de photo (la carte affiche alors la vidéo cinématique).
// ============================================================

import { access } from 'node:fs/promises';

const WIKI_API = 'https://en.wikipedia.org/w/api.php';

// ============================================================
// PHOTOS LOCALES (fond détouré)
// ============================================================
//
// Certaines photos sont préparées hors ligne : fond supprimé et
// cadrage homogène, puis enregistrées dans
// `frontend/public/vehicles/<slug>.png`. Ces fichiers locaux
// sont prioritaires sur l'URL distante.
// ============================================================

const PUBLIC_VEHICLES_DIR = new URL(
  '../../../frontend/public/vehicles/',
  import.meta.url,
);

export function slugify(brand, model) {
  return `${brand}-${model}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Renvoie le chemin web de la photo locale si elle existe.
export async function localPhotoFor(brand, model) {
  const slug = slugify(brand, model);
  const file = new URL(`${slug}.png`, PUBLIC_VEHICLES_DIR);

  try {
    await access(file);
    return `/vehicles/${slug}.png`;
  } catch {
    return null;
  }
}


const USER_AGENT =
  'LuxuryCarsCatalog/1.0 (educational project; contact: admin@luxury.test)';

// ============================================================
// OUTILS
// ============================================================

// Supprime les paramètres de suivi ajoutés par l'API pour
// obtenir une URL d'image stable et hotlinkable.
function stripQuery(url) {
  try {
    const parsed = new URL(url);
    parsed.search = '';
    return parsed.toString();
  } catch {
    return url;
  }
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

// Recherche l'image principale d'un titre précis.
async function imageForTitle(title) {
  const url =
    `${WIKI_API}?action=query&format=json&redirects=1` +
    `&prop=pageimages&piprop=thumbnail&pithumbsize=1280` +
    `&titles=${encodeURIComponent(title)}`;

  const json = await fetchJson(url);
  const pages = json?.query?.pages ?? {};

  for (const page of Object.values(pages)) {
    if (page?.thumbnail?.source) {
      return stripQuery(page.thumbnail.source);
    }
  }

  return null;
}

// Recherche floue : premier résultat correspondant à la requête.
async function imageForSearch(query) {
  const url =
    `${WIKI_API}?action=query&format=json` +
    `&generator=search&gsrlimit=1` +
    `&gsrsearch=${encodeURIComponent(query)}` +
    `&prop=pageimages&piprop=thumbnail&pithumbsize=1280`;

  const json = await fetchJson(url);
  const pages = json?.query?.pages ?? {};

  for (const page of Object.values(pages)) {
    if (page?.thumbnail?.source) {
      return stripQuery(page.thumbnail.source);
    }
  }

  return null;
}

// ============================================================
// RÉSOLUTION D'UNE PHOTO
// ============================================================
//
// 1. Page exacte « Marque Modèle ».
// 2. Recherche plein texte « Marque Modèle ».
// 3. Repli sur la page de la marque.
// ============================================================

export async function resolveVehicleImage(brand, model) {
  const title = `${brand} ${model}`;

  try {
    const exact = await imageForTitle(title);
    if (exact) {
      return exact;
    }
  } catch {
    // On continue avec les solutions de repli.
  }

  try {
    const searched = await imageForSearch(title);
    if (searched) {
      return searched;
    }
  } catch {
    // On continue avec les solutions de repli.
  }

  try {
    const brandImage = await imageForTitle(brand);
    if (brandImage) {
      return brandImage;
    }
  } catch {
    // Aucune image trouvée.
  }

  return null;
}

// ============================================================
// REMPLISSAGE DE LA TABLE `vehicle_images`
// ============================================================

export async function populateVehicleImages(
  client,
  { concurrency = 5, log = console.log } = {},
) {
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

  if (rows.length === 0) {
    log('  (aucun véhicule : photos ignorées)');
    return { total: 0, withImage: 0 };
  }

  const resolved = new Array(rows.length);
  let cursor = 0;
  let withImage = 0;

  async function worker() {
    while (cursor < rows.length) {
      const index = cursor;
      cursor += 1;

      const row = rows[index];

      const imageUrl = null;
      if (imageUrl) {
        withImage += 1;
      }

      resolved[index] = { ...row, imageUrl };
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, rows.length) },
    () => worker(),
  );

  await Promise.all(workers);

  // Écriture atomique : on remplace l'ensemble des images.
  await client.query('BEGIN');

  try {
    await client.query('DELETE FROM vehicle_images');

    for (const row of resolved) {
      if (!row.imageUrl) {
        continue;
      }

      await client.query(
        `INSERT INTO vehicle_images
            (vehicle_id, storage_path, alt_text, is_primary)
         VALUES ($1, $2, $3, true)`,
        [
          row.id,
          row.imageUrl,
          `${row.brand} ${row.model}`,
        ],
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }

  log(
    `  photos : ${withImage}/${rows.length} véhicules avec une image réelle.`,
  );

  return { total: rows.length, withImage };
}
