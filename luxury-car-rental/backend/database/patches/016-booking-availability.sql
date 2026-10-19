-- ============================================================
-- 016 — Booking availability: location hours/timezone + vehicle
--        <-> location assignment
-- ------------------------------------------------------------
-- ADDITIVE ET NON DESTRUCTIF :
--   * aucun DROP, aucune donnée supprimée ;
--   * colonnes ajoutées avec des valeurs par défaut sûres ;
--   * la table d'association est vide par défaut : un véhicule
--     sans association reste desservi par TOUS les lieux actifs
--     (compatibilité totale avec l'existant).
-- ============================================================

ALTER TABLE rental_locations
  ADD COLUMN IF NOT EXISTS timezone varchar(64) NOT NULL DEFAULT 'Europe/Paris';

ALTER TABLE rental_locations
  ADD COLUMN IF NOT EXISTS opens_at time NOT NULL DEFAULT '09:00';

ALTER TABLE rental_locations
  ADD COLUMN IF NOT EXISTS closes_at time NOT NULL DEFAULT '18:00';

ALTER TABLE rental_locations
  ADD COLUMN IF NOT EXISTS turnaround_minutes integer NOT NULL DEFAULT 0;

-- Un point de service doit fermer après son ouverture.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_location_hours'
  ) THEN
    ALTER TABLE rental_locations
      ADD CONSTRAINT chk_location_hours CHECK (closes_at > opens_at);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_location_turnaround'
  ) THEN
    ALTER TABLE rental_locations
      ADD CONSTRAINT chk_location_turnaround CHECK (turnaround_minutes >= 0);
  END IF;
END$$;

-- Fuseau horaire réaliste par pays (les valeurs restent modifiables en admin).
UPDATE rental_locations SET timezone = 'Europe/Berlin'   WHERE country = 'Allemagne';
UPDATE rental_locations SET timezone = 'Europe/Zurich'   WHERE country = 'Suisse';
UPDATE rental_locations SET timezone = 'Europe/Budapest' WHERE country = 'Hongrie';
UPDATE rental_locations SET timezone = 'Europe/Paris'    WHERE country = 'France';

-- Association véhicule <-> lieu de prise en charge autorisé.
CREATE TABLE IF NOT EXISTS vehicle_rental_locations (
  vehicle_id  uuid NOT NULL REFERENCES vehicles (id)          ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES rental_locations (id)  ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (vehicle_id, location_id)
);

CREATE INDEX IF NOT EXISTS idx_vehicle_rental_locations_location
  ON vehicle_rental_locations (location_id);
