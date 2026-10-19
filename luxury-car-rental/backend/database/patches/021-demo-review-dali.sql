-- ==============================================================
-- 021 — DÉMONSTRATION : LOCATION TERMINÉE POUR DALI MAAZOUN
-- ==============================================================
-- Objectif : permettre de tester le parcours d'avis (voiture +
-- service) avec le compte réel « dali maazoun »
-- (dalimazzoun@gmail.com) en lui ajoutant une location TERMINÉE
-- qui inclut des services optionnels.
--
-- Strictement ADDITIF et IDEMPOTENT : aucune donnée existante n'est
-- modifiée ni supprimée. L'enregistrement est repérable par sa note
-- « [demo-review-dali] … ».
-- ==============================================================

-- --------------------------------------------------------------
-- 1) RÉSERVATION TERMINÉE (statut « converted », période passée,
--    véhicule libre, aucun conflit réservation / indisponibilité)
-- --------------------------------------------------------------
WITH demo AS (
  SELECT u.id AS customer_id
  FROM users u
  WHERE u.email = 'dalimazzoun@gmail.com'
), p AS (
  SELECT '2026-09-15 10:00:00+02'::timestamptz AS pickup_at,
         '2026-09-18 10:00:00+02'::timestamptz AS return_at
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
       veh.daily_price, veh.security_deposit, 40, 0,
       0, 3 * veh.daily_price + 40, 'converted',
       '[demo-review-dali] Completed rental with optional services',
       (SELECT id FROM users WHERE role = 'admin' ORDER BY created_at LIMIT 1),
       now()
FROM demo, p, veh
WHERE demo.customer_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM reservations r
    WHERE r.customer_notes = '[demo-review-dali] Completed rental with optional services'
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
       '[demo-review-dali]'
FROM reservations r
WHERE r.customer_notes = '[demo-review-dali] Completed rental with optional services'
  AND NOT EXISTS (SELECT 1 FROM rentals l WHERE l.reservation_id = r.id);

-- --------------------------------------------------------------
-- 3) SERVICES OPTIONNELS (GPS 15 « une fois » + siège enfant 25
--    « une fois » = 40)
-- --------------------------------------------------------------
INSERT INTO reservation_extras (
  reservation_id, extra_id, name_snapshot,
  amount_snapshot, pricing_snapshot, unit_price_snapshot
)
SELECT r.id, e.id, e.name, e.amount, e.pricing, e.amount
FROM reservations r
JOIN premium_extras e
  ON e.code IN ('GPS', 'CHILD_SEAT') AND e.enabled
WHERE r.customer_notes = '[demo-review-dali] Completed rental with optional services'
  AND NOT EXISTS (
    SELECT 1 FROM reservation_extras x WHERE x.reservation_id = r.id
  );
