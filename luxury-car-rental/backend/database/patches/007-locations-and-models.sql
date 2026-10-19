-- Ajout non destructif : modèles 3D et points de livraison configurés par l'entreprise.
-- Les anciennes réservations et anciennes fiches véhicules restent valides.
CREATE TABLE IF NOT EXISTS rental_locations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 code varchar(50) NOT NULL UNIQUE,
 name varchar(120) NOT NULL,
 category varchar(18) NOT NULL CHECK (category IN ('showroom','airport','hotel','city_center','custom')),
 city varchar(100) NOT NULL,
 country varchar(100) NOT NULL,
 address varchar(250) NOT NULL,
 pickup_fee numeric(10,2) NOT NULL DEFAULT 0 CHECK (pickup_fee>=0),
 dropoff_fee numeric(10,2) NOT NULL DEFAULT 0 CHECK (dropoff_fee>=0),
 one_way_fee numeric(10,2) NOT NULL DEFAULT 0 CHECK (one_way_fee>=0),
 can_pickup boolean NOT NULL DEFAULT true,
 can_dropoff boolean NOT NULL DEFAULT true,
 enabled boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rental_locations_public ON rental_locations(enabled,city,category);

-- Le choix et son libellé sont figés lors de la réservation pour l'historique.
ALTER TABLE reservation_preferences ADD COLUMN IF NOT EXISTS pickup_location_id uuid REFERENCES rental_locations(id) ON DELETE SET NULL;
ALTER TABLE reservation_preferences ADD COLUMN IF NOT EXISTS dropoff_location_id uuid REFERENCES rental_locations(id) ON DELETE SET NULL;
ALTER TABLE reservation_preferences ADD COLUMN IF NOT EXISTS pickup_location_snapshot varchar(250);
ALTER TABLE reservation_preferences ADD COLUMN IF NOT EXISTS dropoff_location_snapshot varchar(250);
ALTER TABLE reservation_preferences ADD COLUMN IF NOT EXISTS pickup_address varchar(250);
ALTER TABLE reservation_preferences ADD COLUMN IF NOT EXISTS dropoff_address varchar(250);

-- Un modèle GLB par voiture, nul tant que l'admin n'a rien importé.
CREATE TABLE IF NOT EXISTS vehicle_3d_models (
 vehicle_id uuid PRIMARY KEY REFERENCES vehicles(id) ON DELETE CASCADE,
 model_path text NOT NULL CHECK (model_path LIKE '/vehicles/models/%.glb'),
 uploaded_at timestamptz NOT NULL DEFAULT now()
);
