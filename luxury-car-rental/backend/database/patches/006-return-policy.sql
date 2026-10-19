-- Barème de démonstration. Aucun frais automatique tant qu'un administrateur
-- n'a pas configuré explicitement les tarifs du contrat.
CREATE TABLE IF NOT EXISTS rental_fee_policy (
 id smallint PRIMARY KEY CHECK(id = 1),
 late_fee_per_day numeric(10,2) NOT NULL DEFAULT 0 CHECK(late_fee_per_day >= 0),
 fuel_fee_per_percent numeric(10,2) NOT NULL DEFAULT 0 CHECK(fuel_fee_per_percent >= 0),
 mileage_allowance_per_day integer NOT NULL DEFAULT 200 CHECK(mileage_allowance_per_day >= 0),
 excess_mileage_fee numeric(10,2) NOT NULL DEFAULT 0 CHECK(excess_mileage_fee >= 0),
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO rental_fee_policy(id) VALUES(1) ON CONFLICT DO NOTHING;

-- Garder une référence unique par opération manuelle pour éviter les doubles enregistrements.
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_manual_reference ON payments (rental_id,type,reference) WHERE reference IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_issued_invoice_per_rental ON invoices (rental_id) WHERE status='issued';
