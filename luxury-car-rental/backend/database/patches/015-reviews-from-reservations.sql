-- ==============================================================
-- 015 — AVIS LIÉS À UNE RÉSERVATION
-- ==============================================================
-- Assouplit la règle : un client peut déposer un avis dès qu'il a
-- fait une réservation (plus seulement après une location terminée).
-- Additif et idempotent : aucune donnée existante n'est supprimée.
-- ==============================================================

-- Une réservation n'a pas forcément de location associée.
ALTER TABLE vehicle_reviews ALTER COLUMN rental_id DROP NOT NULL;

-- Rattacher l'avis à la réservation d'origine.
ALTER TABLE vehicle_reviews
  ADD COLUMN IF NOT EXISTS reservation_id uuid REFERENCES reservations(id) ON DELETE CASCADE;

-- Un avis maximum par réservation.
CREATE UNIQUE INDEX IF NOT EXISTS uq_review_reservation
  ON vehicle_reviews(reservation_id) WHERE reservation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reviews_customer ON vehicle_reviews(customer_id);

-- Tout avis doit référencer une location OU une réservation.
DO $$ BEGIN
  ALTER TABLE vehicle_reviews
    ADD CONSTRAINT chk_review_target
    CHECK (rental_id IS NOT NULL OR reservation_id IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
