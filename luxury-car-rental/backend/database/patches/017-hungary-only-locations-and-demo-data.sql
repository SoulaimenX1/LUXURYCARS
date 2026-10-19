-- ============================================================
-- 017 — Points de prise en charge : HONGRIE UNIQUEMENT
--        + jeu de données de démonstration (clients/réservations)
-- ------------------------------------------------------------
-- Demande explicite :
--   1) ne conserver QUE les lieux de prise en charge situés en
--      Hongrie (supprimer France, Allemagne et Suisse) ;
--   2) enrichir la base avec des utilisateurs et des réservations
--      réelles (données cohérentes, contraintes respectées).
--
-- Historique préservé : reservation_preferences.pickup_location_id
-- et dropoff_location_id sont ON DELETE SET NULL, et le libellé
-- figé (pickup_location_snapshot / dropoff_location_snapshot) reste
-- intact. vehicle_rental_locations est ON DELETE CASCADE ; la table
-- reste vide : sans affectation explicite, tous les véhicules sont
-- desservis par les points hongrois activés (règle de repli).
--
-- Aucune donnée existante n'est modifiée en dehors de la
-- suppression des lieux non hongrois. Les lignes de démonstration
-- sont identifiées par un préfixe '[demo]' et le script est
-- ré-exécutable sans doublonner.
-- ============================================================

SET client_encoding TO 'UTF8';

BEGIN;

-- ------------------------------------------------------------
-- 1) LIEUX DE PRISE EN CHARGE : HONGRIE UNIQUEMENT
-- ------------------------------------------------------------

-- Suppression de tous les points hors Hongrie (France 21,
-- Allemagne 12, Suisse 11). Les 5 points hongrois du patch 012
-- ne sont pas touchés.
DELETE FROM rental_locations
WHERE country <> 'Hongrie';

-- Les points hongrois restent actifs et disponibles à la prise en
-- charge comme à la restitution, sur le fuseau Europe/Budapest.
UPDATE rental_locations
SET enabled    = true,
    can_pickup = true,
    can_dropoff = true,
    timezone   = COALESCE(NULLIF(timezone, ''), 'Europe/Budapest')
WHERE country = 'Hongrie';

-- Aucune affectation véhicule <-> lieu : chaque véhicule est
-- desservi par tous les points hongrois activés.
DELETE FROM vehicle_rental_locations;

-- ------------------------------------------------------------
-- 2) CLIENTS DE DÉMONSTRATION
-- ------------------------------------------------------------
-- Mot de passe commun des comptes de démonstration :
--   DemoCustomer123!   (argon2id, vérifié par argon2.verify)

INSERT INTO users (email, password_hash, role, status, first_name, last_name, phone, email_verified_at)
VALUES
 ('laszlo.kovacs@example.com',  '$argon2id$v=19$m=65536,p=4,t=3$tIc36hHgIkFoYIFci/MZsQ$sUzMmDCuxpmt9TxFfVNnmJjxxAJKriJrZZQkYPCB6SE', 'customer', 'active', 'László', 'Kovács', '+36 30 111 0001', now()),
 ('eszter.nagy@example.com',    '$argon2id$v=19$m=65536,p=4,t=3$tIc36hHgIkFoYIFci/MZsQ$sUzMmDCuxpmt9TxFfVNnmJjxxAJKriJrZZQkYPCB6SE', 'customer', 'active', 'Eszter', 'Nagy',   '+36 30 111 0002', now()),
 ('bence.toth@example.com',     '$argon2id$v=19$m=65536,p=4,t=3$tIc36hHgIkFoYIFci/MZsQ$sUzMmDCuxpmt9TxFfVNnmJjxxAJKriJrZZQkYPCB6SE', 'customer', 'active', 'Bence',  'Tóth',   '+36 30 111 0003', now()),
 ('zsofia.horvath@example.com', '$argon2id$v=19$m=65536,p=4,t=3$tIc36hHgIkFoYIFci/MZsQ$sUzMmDCuxpmt9TxFfVNnmJjxxAJKriJrZZQkYPCB6SE', 'customer', 'active', 'Zsófia', 'Horváth', '+36 30 111 0004', now()),
 ('gabor.szabo@example.com',    '$argon2id$v=19$m=65536,p=4,t=3$tIc36hHgIkFoYIFci/MZsQ$sUzMmDCuxpmt9TxFfVNnmJjxxAJKriJrZZQkYPCB6SE', 'customer', 'active', 'Gábor',  'Szabó',  '+36 30 111 0005', now()),
 ('anna.kiss@example.com',      '$argon2id$v=19$m=65536,p=4,t=3$tIc36hHgIkFoYIFci/MZsQ$sUzMmDCuxpmt9TxFfVNnmJjxxAJKriJrZZQkYPCB6SE', 'customer', 'active', 'Anna',   'Kiss',   '+36 30 111 0006', now()),
 ('mate.varga@example.com',     '$argon2id$v=19$m=65536,p=4,t=3$tIc36hHgIkFoYIFci/MZsQ$sUzMmDCuxpmt9TxFfVNnmJjxxAJKriJrZZQkYPCB6SE', 'customer', 'active', 'Máté',   'Varga',  '+36 30 111 0007', now()),
 ('reka.balogh@example.com',    '$argon2id$v=19$m=65536,p=4,t=3$tIc36hHgIkFoYIFci/MZsQ$sUzMmDCuxpmt9TxFfVNnmJjxxAJKriJrZZQkYPCB6SE', 'customer', 'active', 'Réka',   'Balogh', '+36 30 111 0008', now())
ON CONFLICT (email) DO NOTHING;

-- Dossiers clients (permis de conduire hongrois, valides).
INSERT INTO customer_profiles (user_id, date_of_birth, address_line, city, postal_code, country, license_number, license_country, license_issued_on, license_expires_on)
SELECT u.id,
       d.date_of_birth::date,
       d.address_line,
       d.city,
       d.postal_code,
       'HU',
       d.license_number,
       'HU',
       d.license_issued_on::date,
       d.license_expires_on::date
FROM (VALUES
 ('laszlo.kovacs@example.com',  '1985-04-12', 'Andrássy út 22',        'Budapest', '1061', 'HU-1000001', '2010-06-01', '2030-06-01'),
 ('eszter.nagy@example.com',    '1990-09-30', 'Váci utca 8',           'Budapest', '1052', 'HU-1000002', '2012-03-15', '2032-03-15'),
 ('bence.toth@example.com',     '1982-01-22', 'Bartók Béla út 41',     'Budapest', '1114', 'HU-1000003', '2008-11-20', '2028-11-20'),
 ('zsofia.horvath@example.com', '1994-07-08', 'Rákóczi út 15',         'Budapest', '1072', 'HU-1000004', '2015-05-05', '2035-05-05'),
 ('gabor.szabo@example.com',    '1978-12-03', 'Kossuth Lajos utca 7',  'Budapest', '1053', 'HU-1000005', '2005-02-10', '2027-02-10'),
 ('anna.kiss@example.com',      '1997-05-19', 'Deák Ferenc tér 3',     'Budapest', '1052', 'HU-1000006', '2018-08-08', '2038-08-08'),
 ('mate.varga@example.com',     '1988-10-27', 'Üllői út 63',           'Budapest', '1091', 'HU-1000007', '2011-09-12', '2031-09-12'),
 ('reka.balogh@example.com',    '1992-02-14', 'Bajcsy-Zsilinszky út 5','Budapest', '1065', 'HU-1000008', '2014-04-04', '2034-04-04')
) AS d(email, date_of_birth, address_line, city, postal_code, license_number, license_issued_on, license_expires_on)
JOIN users u ON u.email = d.email
ON CONFLICT (user_id) DO NOTHING;

-- ------------------------------------------------------------
-- 3) RÉSERVATIONS DE DÉMONSTRATION
-- ------------------------------------------------------------
-- Véhicules actifs sans conflit sur la période, un véhicule par
-- réservation (aucun chevauchement : contrainte EXCLUDE respectée).
-- Montants calculés par la base : total = jours * prix/jour.

INSERT INTO reservations (customer_id, vehicle_id, pickup_at, return_at, rental_days,
                          daily_price, deposit_amount, total_amount,
                          extras_amount, delivery_amount, discount_amount,
                          status, customer_notes)
SELECT p.user_id,
       v.id,
       s.pickup_at,
       s.return_at,
       GREATEST(1, CEIL(EXTRACT(EPOCH FROM (s.return_at - s.pickup_at)) / 86400))::int AS rental_days,
       v.daily_price,
       v.security_deposit,
       GREATEST(1, CEIL(EXTRACT(EPOCH FROM (s.return_at - s.pickup_at)) / 86400))::int * v.daily_price AS total_amount,
       0, 0, 0,
       s.status::reservation_status,
       '[demo] ' || s.plate
FROM (VALUES
 ('LC-0001', 'laszlo.kovacs@example.com',  '2026-12-05 10:00:00+01'::timestamptz, '2026-12-08 10:00:00+01'::timestamptz, 'confirmed'),
 ('LC-0006', 'eszter.nagy@example.com',    '2026-12-10 10:00:00+01'::timestamptz, '2026-12-14 10:00:00+01'::timestamptz, 'pending'),
 ('LC-0007', 'bence.toth@example.com',     '2026-12-18 10:00:00+01'::timestamptz, '2026-12-21 10:00:00+01'::timestamptz, 'confirmed'),
 ('LC-0008', 'zsofia.horvath@example.com', '2026-12-27 10:00:00+01'::timestamptz, '2027-01-02 10:00:00+01'::timestamptz, 'confirmed'),
 ('LC-0010', 'gabor.szabo@example.com',    '2027-01-05 10:00:00+01'::timestamptz, '2027-01-08 10:00:00+01'::timestamptz, 'pending'),
 ('LC-0012', 'anna.kiss@example.com',      '2027-01-12 10:00:00+01'::timestamptz, '2027-01-15 10:00:00+01'::timestamptz, 'converted'),
 ('LC-0015', 'mate.varga@example.com',     '2027-01-20 10:00:00+01'::timestamptz, '2027-01-24 10:00:00+01'::timestamptz, 'confirmed'),
 ('LC-0016', 'reka.balogh@example.com',    '2027-02-02 10:00:00+01'::timestamptz, '2027-02-05 10:00:00+01'::timestamptz, 'cancelled'),
 ('LC-0023', 'laszlo.kovacs@example.com',  '2027-02-08 10:00:00+01'::timestamptz, '2027-02-10 10:00:00+01'::timestamptz, 'confirmed'),
 ('LC-0024', 'eszter.nagy@example.com',    '2027-02-14 10:00:00+01'::timestamptz, '2027-02-18 10:00:00+01'::timestamptz, 'pending'),
 ('LC-0025', 'bence.toth@example.com',     '2027-02-22 10:00:00+01'::timestamptz, '2027-02-25 10:00:00+01'::timestamptz, 'confirmed'),
 ('LC-0026', 'zsofia.horvath@example.com', '2027-03-01 10:00:00+01'::timestamptz, '2027-03-04 10:00:00+01'::timestamptz, 'expired'),
 ('LC-0027', 'gabor.szabo@example.com',    '2027-03-08 10:00:00+01'::timestamptz, '2027-03-12 10:00:00+01'::timestamptz, 'confirmed'),
 ('LC-0028', 'anna.kiss@example.com',      '2027-03-15 10:00:00+01'::timestamptz, '2027-03-18 10:00:00+01'::timestamptz, 'pending'),
 ('LC-0029', 'mate.varga@example.com',     '2027-03-20 10:00:00+01'::timestamptz, '2027-03-23 10:00:00+01'::timestamptz, 'converted'),
 ('LC-0030', 'reka.balogh@example.com',    '2026-11-18 10:00:00+01'::timestamptz, '2026-11-21 10:00:00+01'::timestamptz, 'confirmed')
) AS s(plate, email, pickup_at, return_at, status)
JOIN vehicles v ON v.license_plate = s.plate
JOIN customer_profiles p ON p.user_id = (SELECT u.id FROM users u WHERE u.email = s.email)
WHERE NOT EXISTS (
  SELECT 1 FROM reservations r WHERE r.customer_notes = '[demo] ' || s.plate
);

-- ------------------------------------------------------------
-- 4) PRÉFÉRENCES DE PRISE EN CHARGE (points hongrois)
-- ------------------------------------------------------------
-- Répartition cyclique sur les 5 points hongrois pour refléter des
-- cas réels (aéroport, centre-ville, hôtel, gare, showroom).

WITH demo AS (
  SELECT r.id, row_number() OVER (ORDER BY r.reservation_number) AS rn
  FROM reservations r
  WHERE r.customer_notes LIKE '[demo]%'
    AND NOT EXISTS (SELECT 1 FROM reservation_preferences p WHERE p.reservation_id = r.id)
), loc AS (
  SELECT id, name, city, country, address, category,
         row_number() OVER (ORDER BY name) AS rn,
         count(*) OVER () AS total
  FROM rental_locations
  WHERE country = 'Hongrie'
)
INSERT INTO reservation_preferences (reservation_id, pickup_method,
                                      pickup_location_id, dropoff_location_id,
                                      pickup_location_snapshot, dropoff_location_snapshot,
                                      pickup_address, dropoff_address)
SELECT d.id,
       CASE WHEN l.category = 'airport' THEN 'airport' ELSE 'branch' END,
       l.id,
       l.id,
       l.name || ' — ' || l.city || ', ' || l.country,
       l.name || ' — ' || l.city || ', ' || l.country,
       l.address,
       l.address
FROM demo d
JOIN loc l ON l.rn = ((d.rn - 1) % (SELECT total FROM loc LIMIT 1)) + 1;

-- ------------------------------------------------------------
-- 5) EXTRAS SUR QUELQUES RÉSERVATIONS (totaux recalculés)
-- ------------------------------------------------------------
-- GPS (forfait) + conducteur additionnel (par jour) sur les 3
-- premières réservations de démonstration.

INSERT INTO reservation_extras (reservation_id, extra_id, name_snapshot,
                                amount_snapshot, pricing_snapshot, unit_price_snapshot)
SELECT t.id,
       e.id,
       e.name,
       CASE WHEN e.pricing = 'daily' THEN e.amount * t.rental_days ELSE e.amount END,
       e.pricing,
       e.amount
FROM (SELECT id, rental_days FROM reservations
      WHERE customer_notes LIKE '[demo]%'
      ORDER BY reservation_number LIMIT 3) t
CROSS JOIN premium_extras e
WHERE e.name IN ('GPS navigation', 'Additional driver')
ON CONFLICT (reservation_id, extra_id) DO NOTHING;

UPDATE reservations r
SET extras_amount = sub.total,
    total_amount  = r.rental_days * r.daily_price + sub.total + r.delivery_amount - r.discount_amount
FROM (SELECT reservation_id, SUM(amount_snapshot) AS total
      FROM reservation_extras GROUP BY reservation_id) sub
WHERE sub.reservation_id = r.id
  AND r.customer_notes LIKE '[demo]%';

COMMIT;

-- ------------------------------------------------------------
-- Vérifications attendues après exécution :
--   SELECT country, count(*) FROM rental_locations GROUP BY country;
--     -> Hongrie | 5   (aucune autre ligne)
--   SELECT count(*) FROM users;              -- 10 + 8  = 18
--   SELECT count(*) FROM customer_profiles;  --  6 + 8  = 14
--   SELECT count(*) FROM reservations;       -- 19 + 16 = 35
-- ------------------------------------------------------------
