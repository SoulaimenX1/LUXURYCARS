-- ============================================================
-- 010 — Valeur du véhicule (« vehicle value »)
-- ------------------------------------------------------------
-- Ajoute la valeur du véhicule (valeur d'achat / de marché).
-- Elle est affichée dans l'administration ET dans le catalogue
-- client, et doit TOUJOURS être un nombre réel strictement
-- positif (contrainte CHECK vehicle_value > 0).
--
-- Les voitures déjà présentes sont analysées puis valorisées à
-- partir de leur modèle réel (estimations de marché). Toute
-- voiture non répertoriée reçoit une estimation de repli
-- dérivée de son prix journalier.
--
-- Patch idempotent et non destructif : aucune donnée supprimée.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Colonne (d'abord facultative le temps de valoriser les
--    lignes existantes).
-- ------------------------------------------------------------

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS vehicle_value numeric(12, 2);

-- ------------------------------------------------------------
-- 2. Valorisation des voitures existantes (modèle => estimation).
--    Les valeurs sont des estimations de marché en euros.
-- ------------------------------------------------------------

WITH estimates(brand_name, model_name, amount) AS (
  VALUES
    -- Aston Martin
    ('Aston Martin',    'DB12',                    250000::numeric),
    ('Aston Martin',    'DBS Superleggera',        330000),
    ('Aston Martin',    'DBX707',                  260000),
    ('Aston Martin',    'Valkyrie',               2700000),
    ('Aston Martin',    'Vantage',                 200000),
    -- Audi
    ('Audi',            'R8 V10 Performance',      220000),
    ('Audi',            'RS e-tron GT',            150000),
    ('Audi',            'RS Q8',                   130000),
    -- Bentley
    ('Bentley',         'Bentayga Speed',          250000),
    ('Bentley',         'Continental GT Speed',    280000),
    ('Bentley',         'Continental GTC',         250000),
    ('Bentley',         'Flying Spur',             260000),
    -- BMW
    ('BMW',             'i7 M70',                  180000),
    ('BMW',             'i8 Roadster',             150000),
    ('BMW',             'M5 CS',                   150000),
    ('BMW',             'M8 Competition',          180000),
    -- Bugatti
    ('Bugatti',         'Chiron',                 2800000),
    ('Bugatti',         'Chiron Super Sport 300+',3800000),
    -- Ferrari
    ('Ferrari',         '296 GTB',                 350000),
    ('Ferrari',         '812 Superfast',           400000),
    ('Ferrari',         'Portofino M',             280000),
    ('Ferrari',         'Purosangue',              450000),
    ('Ferrari',         'Roma',                    280000),
    ('Ferrari',         'SF90 Stradale',           500000),
    -- Lamborghini
    ('Lamborghini',     'Aventador SVJ',           550000),
    ('Lamborghini',     'Countach LPI 800-4',     2200000),
    ('Lamborghini',     'Huracán EVO',             280000),
    ('Lamborghini',     'Huracán Sterrato',        320000),
    ('Lamborghini',     'Revuelto',                550000),
    ('Lamborghini',     'Urus Performante',        300000),
    -- Lexus
    ('Lexus',           'LC 500',                  110000),
    ('Lexus',           'LS 500h',                 120000),
    -- Maserati
    ('Maserati',        'GranTurismo Folgore',     200000),
    ('Maserati',        'Grecale Trofeo',          130000),
    ('Maserati',        'MC20',                    250000),
    -- McLaren
    ('McLaren',         '720S',                    320000),
    ('McLaren',         '765LT',                   400000),
    ('McLaren',         'Artura',                  250000),
    ('McLaren',         'GT',                      230000),
    -- Mercedes-AMG
    ('Mercedes-AMG',    'G 63',                    200000),
    ('Mercedes-AMG',    'GT 63 S',                 200000),
    ('Mercedes-AMG',    'ONE',                    2700000),
    ('Mercedes-AMG',    'SL 63',                   200000),
    -- Mercedes-Maybach
    ('Mercedes-Maybach', 'GLS 600',                220000),
    ('Mercedes-Maybach', 'S 680',                  260000),
    -- Porsche
    ('Porsche',         '718 Cayman GT4 RS',       180000),
    ('Porsche',         '911 GT3',                 200000),
    ('Porsche',         '911 GT3 RS',              280000),
    ('Porsche',         '911 Turbo S',             250000),
    ('Porsche',         '918 Spyder',             1500000),
    ('Porsche',         'Cayenne Turbo GT',        200000),
    ('Porsche',         'Panamera Turbo S',        200000),
    ('Porsche',         'Taycan Turbo S',          200000),
    -- Rolls-Royce
    ('Rolls-Royce',     'Cullinan',                400000),
    ('Rolls-Royce',     'Dawn',                    350000),
    ('Rolls-Royce',     'Ghost',                   400000),
    ('Rolls-Royce',     'Phantom',                 550000),
    ('Rolls-Royce',     'Spectre',                 450000)
)
UPDATE vehicles AS v
   SET vehicle_value = e.amount
  FROM vehicle_models AS m
  JOIN brands AS b
    ON b.id = m.brand_id
  JOIN estimates AS e
    ON e.brand_name = b.name
   AND e.model_name = m.name
 WHERE v.model_id = m.id
   AND (v.vehicle_value IS NULL OR v.vehicle_value <= 0);

-- ------------------------------------------------------------
-- 3. Repli : toute voiture non répertoriée reçoit une estimation
--    calculée (≈ 150 jours de location, minimum 1 000).
-- ------------------------------------------------------------

UPDATE vehicles
   SET vehicle_value = GREATEST(ROUND(daily_price * 150, 2), 1000)
 WHERE vehicle_value IS NULL
    OR vehicle_value <= 0;

-- ------------------------------------------------------------
-- 4. La valeur devient obligatoire et strictement positive.
-- ------------------------------------------------------------

ALTER TABLE vehicles
  ALTER COLUMN vehicle_value SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'vehicles_vehicle_value_check'
  ) THEN
    ALTER TABLE vehicles
      ADD CONSTRAINT vehicles_vehicle_value_check
      CHECK (vehicle_value > 0);
  END IF;
END $$;
