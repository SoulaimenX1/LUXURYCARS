-- Historique des prolongations : une entrée par décision administrative.
-- Ce patch est idempotent et compatible avec une base déjà initialisée.
CREATE TABLE IF NOT EXISTS rental_extensions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    rental_id uuid NOT NULL REFERENCES rentals(id) ON DELETE RESTRICT,
    old_return_at timestamptz NOT NULL,
    new_return_at timestamptz NOT NULL,
    old_total_amount numeric(12,2) NOT NULL CHECK (old_total_amount >= 0),
    new_total_amount numeric(12,2) NOT NULL CHECK (new_total_amount >= old_total_amount),
    additional_amount numeric(12,2) NOT NULL CHECK (additional_amount >= 0),
    extended_by uuid NOT NULL REFERENCES users(id),
    reason varchar(500),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_extension_later CHECK (new_return_at > old_return_at),
    CONSTRAINT chk_extension_amount CHECK (additional_amount = new_total_amount - old_total_amount)
);
CREATE INDEX IF NOT EXISTS idx_rental_extensions_rental ON rental_extensions (rental_id, created_at DESC);
