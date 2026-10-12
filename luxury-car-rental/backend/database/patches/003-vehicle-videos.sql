-- =====================================================================
-- Patch 003 — media (photos + vidéos) par véhicule.
--
-- Idempotent : peut être exécuté plusieurs fois sans erreur.
--
-- Contexte
-- --------
-- La table `vehicle_images` ne stockait qu'une photo par véhicule.
-- Pour permettre d'associer AUSSI une vidéo (et de conserver une
-- photo), on ajoute :
--
--   * `media_type`  : 'image' ou 'video' (nouveau type ENUM) ;
--   * `poster_path` : image d'attente facultative d'une vidéo.
--
-- L'ancien index unique (une seule ligne principale par véhicule)
-- est remplacé par un index unique par véhicule ET par type : on
-- peut donc avoir une photo principale ET une vidéo principale.
--
-- Ce patch reflète les changements de `database/schema.sql`
-- (source de vérité).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Nouveau type ENUM media_type
-- ---------------------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'media_type'
    ) THEN
        CREATE TYPE media_type AS ENUM ('image', 'video');
    END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2. Nouvelles colonnes sur vehicle_images
-- ---------------------------------------------------------------------
--
-- Les lignes existantes (photos) deviennent media_type = 'image' grâce
-- à la valeur par défaut.

ALTER TABLE vehicle_images
    ADD COLUMN IF NOT EXISTS media_type media_type NOT NULL DEFAULT 'image',
    ADD COLUMN IF NOT EXISTS poster_path text;

-- ---------------------------------------------------------------------
-- 3. Remplacement de l'index unique
-- ---------------------------------------------------------------------
--
-- Avant : une seule ligne `is_primary` par véhicule.
-- Après : une ligne principale par véhicule et par type de média.

DROP INDEX IF EXISTS uq_vehicle_primary_image;

CREATE UNIQUE INDEX IF NOT EXISTS uq_vehicle_primary_media
    ON vehicle_images (vehicle_id, media_type)
    WHERE
        is_primary;
