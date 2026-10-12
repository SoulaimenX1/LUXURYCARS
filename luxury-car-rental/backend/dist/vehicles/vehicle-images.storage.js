// ==========================================================
// STOCKAGE DISQUE DES PHOTOS DE VÉHICULES
// ==========================================================
//
// Les photos sont enregistrées dans le dossier public du
// frontend :
//
//   frontend/public/vehicles/<fichier>
//
// Next.js sert ensuite automatiquement ces fichiers à
// l'adresse :
//
//   /vehicles/<fichier>
//
// C'est exactement la valeur enregistrée dans la colonne
// `vehicle_images.storage_path`, ce qui permet aux cartes du
// catalogue public d'afficher la photo sans transformation.
//
// Le dossier peut être redéfini avec la variable
// d'environnement VEHICLE_IMAGES_DIR.
// ==========================================================
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
// ==========================================================
// EMPLACEMENT DES PHOTOS
// ==========================================================
// Dossier du module compilé :
// - en production : backend/dist/vehicles
// - en développement : backend/dist/vehicles (nest start)
// La racine du backend se trouve donc deux niveaux plus haut.
const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = resolve(MODULE_DIR, '..', '..');
const DEFAULT_VEHICLE_IMAGES_DIR = resolve(BACKEND_ROOT, '..', 'frontend', 'public', 'vehicles');
export function vehicleImagesDir() {
    const override = process.env.VEHICLE_IMAGES_DIR;
    if (override && override.trim() !== '') {
        return resolve(override);
    }
    return DEFAULT_VEHICLE_IMAGES_DIR;
}
// ==========================================================
// TYPES D'IMAGES ACCEPTÉS
// ==========================================================
const MIME_EXTENSIONS = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/avif': '.avif',
    'image/gif': '.gif'
};
export function isAllowedImageMime(mime) {
    return Object.prototype.hasOwnProperty.call(MIME_EXTENSIONS, mime.toLowerCase());
}
// ==========================================================
// TYPES DE VIDÉOS ACCEPTÉS
// ==========================================================
//
// On accepte les formats réellement lisibles par les
// navigateurs modernes (MP4/H.264, WebM, Ogg). Le QuickTime
// (.mov) est accepté à l'envoi — s'il ne peut pas être lu par
// le navigateur, la carte retombe sur la photo du véhicule.
const VIDEO_EXTENSIONS = {
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'video/ogg': '.ogv',
    'video/quicktime': '.mov'
};
export function isAllowedVideoMime(mime) {
    return Object.prototype.hasOwnProperty.call(VIDEO_EXTENSIONS, mime.toLowerCase());
}
// Déterminer l'extension à partir du type MIME, avec repli
// sur le nom d'origine du fichier.
export function extensionForVideo(file) {
    const fromMime = VIDEO_EXTENSIONS[file.mimetype.toLowerCase()];
    if (fromMime) {
        return fromMime;
    }
    const original = extname(file.originalname).toLowerCase();
    if (original === '.mp4' || original === '.webm' || original === '.ogv' || original === '.ogg' || original === '.mov') {
        return original === '.ogg' ? '.ogv' : original;
    }
    return '.mp4';
}
// Déterminer l'extension à partir du type MIME, avec repli
// sur le nom d'origine du fichier.
export function extensionForImage(file) {
    const fromMime = MIME_EXTENSIONS[file.mimetype.toLowerCase()];
    if (fromMime) {
        return fromMime;
    }
    const fromName = extname(file.originalname).toLowerCase();
    return /^\.[a-z0-9]{2,5}$/.test(fromName) ? fromName : '.img';
}
// Transformer une immatriculation en nom de fichier sûr.
export function slugifyPlate(plate) {
    const slug = plate.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return slug || 'vehicle';
}
// ==========================================================
// ÉCRITURE DU FICHIER
// ==========================================================
//
// Retourne le chemin web à enregistrer dans
// vehicle_images.storage_path, ex. /vehicles/ab-123-cd-image-....png
// ou /vehicles/ab-123-cd-video-....mp4.
//
// `kind` sert à la fois à préfixer le nom du fichier (pour
// distinguer photo et vidéo) et à choisir l'extension.
export async function storeVehicleMedia(file, plate, kind) {
    const directory = vehicleImagesDir();
    // Créer le dossier s'il n'existe pas encore.
    await mkdir(directory, {
        recursive: true
    });
    const extension = kind === 'video' ? extensionForVideo(file) : extensionForImage(file);
    const filename = `${slugifyPlate(plate)}-${kind}-${Date.now()}${extension}`;
    await writeFile(join(directory, filename), file.buffer);
    return `/vehicles/${filename}`;
}
// ==========================================================
// SUPPRESSION D'UNE ANCIENNE PHOTO
// ==========================================================
//
// On ne supprime que les fichiers appartenant au dossier
// /vehicles/. Les éventuelles anciennes URL distantes
// (héritées du script de résolution automatique) sont
// ignorées.
export async function removeStoredVehicleMedia(storagePath) {
    if (!storagePath || !storagePath.startsWith('/vehicles/')) {
        return;
    }
    const filename = basename(storagePath);
    if (!filename) {
        return;
    }
    try {
        await unlink(join(vehicleImagesDir(), filename));
    } catch  {
    // Fichier déjà absent : on continue.
    }
}

//# sourceMappingURL=vehicle-images.storage.js.map