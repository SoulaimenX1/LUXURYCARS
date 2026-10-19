-- ==============================================================
-- 019 — SECTION « SERVICE » DE L'AVIS CLIENT
-- ==============================================================
-- Un avis client comporte désormais deux volets indépendants :
--   1) l'avis VOITURE (note + titre + commentaire) — toujours présent ;
--   2) l'avis SERVICE (note + commentaire) — facultatif, proposé
--      uniquement lorsque la réservation a inclus des options
--      (prestation optionnelle : GPS, conducteur, protection…).
-- La validation « réservation avec options » est faite en service
-- (premium.service) ; le schéma garantit seulement la cohérence.
-- Additif et idempotent : aucune donnée existante n'est supprimée.
-- ==============================================================

ALTER TABLE vehicle_reviews ADD COLUMN IF NOT EXISTS service_rating smallint;
ALTER TABLE vehicle_reviews ADD COLUMN IF NOT EXISTS service_comment varchar(1500);

-- Note de service : 1 à 5, ou absente.
DO $$ BEGIN
  ALTER TABLE vehicle_reviews DROP CONSTRAINT IF EXISTS chk_review_service_rating;
  ALTER TABLE vehicle_reviews ADD CONSTRAINT chk_review_service_rating
    CHECK (service_rating IS NULL OR service_rating BETWEEN 1 AND 5);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- La note et le commentaire de service vont toujours ensemble.
DO $$ BEGIN
  ALTER TABLE vehicle_reviews DROP CONSTRAINT IF EXISTS chk_review_service_pair;
  ALTER TABLE vehicle_reviews ADD CONSTRAINT chk_review_service_pair
    CHECK ((service_rating IS NULL) = (service_comment IS NULL));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Avis existants : les deux colonnes sont NULL, la contrainte est respectée.
