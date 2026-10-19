-- ==============================================================
-- 020 — DÉMONSTRATION : AVIS VOITURE + AVIS SERVICE
-- ==============================================================
-- Objectif : rendre le parcours d'avis réellement démontrable pour
-- le client de démonstration (laszlo.kovacs@example.com) :
--   • une location TERMINÉE (contrat clôturé) qui inclut des
--     services optionnels → le formulaire affiche le volet
--     « avis voiture » ET le volet « avis service » ;
--   • quelques réservations CONFIRMÉES supplémentaires.
-- Strictement ADDITIF et IDEMPOTENT : aucune donnée existante n'est
-- modifiée ni supprimée. Chaque enregistrement de démonstration est
-- repérable par sa note (« [demo-review] … » / « [demo-confirmed] … »).
-- ==============================================================

-- --------------------------------------------------------------
-- 1) LOCATION TERMINÉE AVEC SERVICES OPTIONNELS
--    (réservation « converted » passée, véhicule libre, aucun
--     conflit avec une réservation ou une indisponibilité)
-- --------------------------------------------------------------
WITH demo AS (
  SELECT p.user_id AS customer_id
  FROM customer_profiles p
  JOIN users u ON u.id = p.user_id
  WHERE u.email = 'laszlo.kovacs@example.com'
), p AS (
  SELECT '2025-06-10 10:00:00+02'::timestamptz AS pickup_at,
         '2025-06-13 10:00:00+02'::timestamptz AS return_at
), veh AS (
  SELECT v.id, v.daily_price, COALESCE(v.security_deposit, 0) AS security_deposit
  FROM vehicles v, p
  WHERE v.status = 'active'
    AND v.daily_price IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM reservations r
      WHERE r.vehicle_id = v.id
        AND r.status IN ('pending','confirmed','converted')
        AND r.period && tstzrange(p.pickup_at, p.return_at, '[)')
    )
    AND NOT EXISTS (
      SELECT 1 FROM vehicle_unavailability u
      WHERE u.vehicle_id = v.id
        AND u.period && tstzrange(p.pickup_at, p.return_at, '[)')
    )
  ORDER BY v.daily_price DESC, v.id
  LIMIT 1
)
INSERT INTO reservations (
  customer_id, vehicle_id, pickup_at, return_at, rental_days,
  daily_price, deposit_amount, extras_amount, delivery_amount,
  discount_amount, total_amount, status, customer_notes, decided_by, decided_at
)
SELECT demo.customer_id, veh.id, p.pickup_at, p.return_at, 3,
       veh.daily_price, veh.security_deposit, 60, 0,
       0, 3 * veh.daily_price + 60, 'converted',
       '[demo-review] Completed rental with optional services',
       (SELECT id FROM users WHERE role = 'admin' ORDER BY created_at LIMIT 1),
       now()
FROM demo, p, veh
WHERE demo.customer_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM reservations r
    WHERE r.customer_notes = '[demo-review] Completed rental with optional services'
  );

-- --------------------------------------------------------------
-- 2) CONTRAT DE LOCATION CLÔTURÉ (condition d'éligibilité à l'avis)
-- --------------------------------------------------------------
INSERT INTO rentals (
  reservation_id, status, started_at, expected_return_at,
  returned_at, closed_at, opened_by, closed_by, notes
)
SELECT r.id, 'closed', r.pickup_at, r.return_at,
       r.return_at + interval '1 hour', r.return_at + interval '2 hours',
       (SELECT id FROM users WHERE role = 'admin' ORDER BY created_at LIMIT 1),
       (SELECT id FROM users WHERE role = 'admin' ORDER BY created_at LIMIT 1),
       '[demo-review]'
FROM reservations r
WHERE r.customer_notes = '[demo-review] Completed rental with optional services'
  AND NOT EXISTS (SELECT 1 FROM rentals l WHERE l.reservation_id = r.id);

-- --------------------------------------------------------------
-- 3) SERVICES OPTIONNELS (GPS offert « une fois » + conducteur
--    additionnel facturé « par jour » sur 3 jours = 15 + 45 = 60)
-- --------------------------------------------------------------
INSERT INTO reservation_extras (
  reservation_id, extra_id, name_snapshot,
  amount_snapshot, pricing_snapshot, unit_price_snapshot
)
SELECT r.id, e.id, e.name, e.amount, e.pricing, e.amount
FROM reservations r
JOIN premium_extras e
  ON e.code IN ('GPS', 'EXTRA_DRIVER') AND e.enabled
WHERE r.customer_notes = '[demo-review] Completed rental with optional services'
  AND NOT EXISTS (
    SELECT 1 FROM reservation_extras x WHERE x.reservation_id = r.id
  );

-- --------------------------------------------------------------
-- 4) RÉSERVATIONS CONFIRMÉES SUPPLÉMENTAIRES (client de démo)
-- --------------------------------------------------------------
WITH demo AS (
  SELECT p.user_id AS customer_id
  FROM customer_profiles p
  JOIN users u ON u.id = p.user_id
  WHERE u.email = 'laszlo.kovacs@example.com'
), p AS (
  SELECT '2027-05-10 10:00:00+02'::timestamptz AS pickup_at,
         '2027-05-13 10:00:00+02'::timestamptz AS return_at
), veh AS (
  SELECT v.id, v.daily_price, COALESCE(v.security_deposit, 0) AS security_deposit
  FROM vehicles v, p
  WHERE v.status = 'active'
    AND v.daily_price IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM reservations r
      WHERE r.vehicle_id = v.id
        AND r.status IN ('pending','confirmed','converted')
        AND r.period && tstzrange(p.pickup_at, p.return_at, '[)')
    )
    AND NOT EXISTS (
      SELECT 1 FROM vehicle_unavailability u
      WHERE u.vehicle_id = v.id
        AND u.period && tstzrange(p.pickup_at, p.return_at, '[)')
    )
  ORDER BY v.daily_price DESC, v.id
  LIMIT 1
)
INSERT INTO reservations (
  customer_id, vehicle_id, pickup_at, return_at, rental_days,
  daily_price, deposit_amount, extras_amount, delivery_amount,
  discount_amount, total_amount, status, customer_notes, decided_by, decided_at
)
SELECT demo.customer_id, veh.id, p.pickup_at, p.return_at, 3,
       veh.daily_price, veh.security_deposit, 0, 0,
       0, 3 * veh.daily_price, 'confirmed',
       '[demo-confirmed] Upcoming confirmed rental',
       (SELECT id FROM users WHERE role = 'admin' ORDER BY created_at LIMIT 1),
       now()
FROM demo, p, veh
WHERE demo.customer_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM reservations r
    WHERE r.customer_notes = '[demo-confirmed] Upcoming confirmed rental'
  );

WITH demo AS (
  SELECT p.user_id AS customer_id
  FROM customer_profiles p
  JOIN users u ON u.id = p.user_id
  WHERE u.email = 'laszlo.kovacs@example.com'
), p AS (
  SELECT '2027-06-07 10:00:00+02'::timestamptz AS pickup_at,
         '2027-06-10 10:00:00+02'::timestamptz AS return_at
), veh AS (
  SELECT v.id, v.daily_price, COALESCE(v.security_deposit, 0) AS security_deposit
  FROM vehicles v, p
  WHERE v.status = 'active'
    AND v.daily_price IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM reservations r
      WHERE r.vehicle_id = v.id
        AND r.status IN ('pending','confirmed','converted')
        AND r.period && tstzrange(p.pickup_at, p.return_at, '[)')
    )
    AND NOT EXISTS (
      SELECT 1 FROM vehicle_unavailability u
      WHERE u.vehicle_id = v.id
        AND u.period && tstzrange(p.pickup_at, p.return_at, '[)')
    )
  ORDER BY v.daily_price DESC, v.id
  LIMIT 1
)
INSERT INTO reservations (
  customer_id, vehicle_id, pickup_at, return_at, rental_days,
  daily_price, deposit_amount, extras_amount, delivery_amount,
  discount_amount, total_amount, status, customer_notes, decided_by, decided_at
)
SELECT demo.customer_id, veh.id, p.pickup_at, p.return_at, 3,
       veh.daily_price, veh.security_deposit, 0, 0,
       0, 3 * veh.daily_price, 'confirmed',
       '[demo-confirmed] Upcoming confirmed rental 2',
       (SELECT id FROM users WHERE role = 'admin' ORDER BY created_at LIMIT 1),
       now()
FROM demo, p, veh
WHERE demo.customer_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM reservations r
    WHERE r.customer_notes = '[demo-confirmed] Upcoming confirmed rental 2'
  );
