-- =====================================================================
-- LUXURY CARS — Création de TOUTES les tables de la base de données
-- PostgreSQL 15+
-- 22 tables, 19 enums, contraintes, index, triggers, fonctions et vues.
-- Ordre respectant les dépendances de clés étrangères.
-- Dérivé de backend/database/schema.sql (source de vérité).
-- =====================================================================
-- =====================================================================

-- Web-Based Luxury Car Rental Management System

-- PostgreSQL 15+ schema (21 tables, 3NF)

-- Assumptions: payments are recorded by staff (no gateway), daily pricing,

-- roles = customer / staff / admin, default currency EUR.

-- =====================================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;
-- needed for exclusion constraints on (uuid, range)

CREATE EXTENSION IF NOT EXISTS citext;
-- case-insensitive e-mail

-- ---------------------------------------------------------------------

-- 1. ENUMERATED TYPES

-- ---------------------------------------------------------------------

CREATE TYPE user_role            AS ENUM ('customer', 'staff', 'admin');

CREATE TYPE account_status       AS ENUM ('invited', 'active', 'suspended');

CREATE TYPE token_type           AS ENUM ('password_reset', 'email_verification');

CREATE TYPE transmission_type    AS ENUM ('automatic', 'manual', 'semi_automatic');

CREATE TYPE fuel_type            AS ENUM ('petrol', 'diesel', 'hybrid', 'plug_in_hybrid', 'electric');

CREATE TYPE vehicle_status       AS ENUM ('active', 'maintenance', 'retired');

CREATE TYPE media_type           AS ENUM ('image', 'video');

CREATE TYPE unavailability_reason AS ENUM ('maintenance', 'repair', 'inspection', 'other');

CREATE TYPE reservation_status   AS ENUM ('pending', 'confirmed', 'rejected', 'cancelled', 'expired', 'converted');

CREATE TYPE rental_status        AS ENUM ('active', 'returned', 'closed');

CREATE TYPE inspection_type      AS ENUM ('handover', 'return');

CREATE TYPE condition_rating     AS ENUM ('excellent', 'good', 'fair', 'damaged');

CREATE TYPE damage_severity      AS ENUM ('minor', 'moderate', 'major');

CREATE TYPE payment_type         AS ENUM ('rental_payment', 'deposit_payment', 'deposit_refund', 'charge_payment', 'refund');

CREATE TYPE payment_method       AS ENUM ('cash', 'card', 'bank_transfer');

CREATE TYPE deposit_status       AS ENUM ('pending', 'held', 'released', 'partially_retained', 'retained');

CREATE TYPE charge_type          AS ENUM ('late_return', 'fuel', 'mileage', 'damage', 'cleaning', 'other');

CREATE TYPE invoice_status       AS ENUM ('draft', 'issued', 'paid', 'void');

CREATE TYPE document_type        AS ENUM ('contract', 'invoice', 'inspection_report', 'other');

CREATE TYPE notification_type    AS ENUM ('new_vehicle', 'special_edition', 'limited_edition', 'general');

-- Human-readable business numbers

CREATE SEQUENCE reservation_number_seq;

CREATE SEQUENCE contract_number_seq;

CREATE SEQUENCE invoice_number_seq;

-- Generic trigger function: keeps updated_at accurate

CREATE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$

BEGIN

  NEW.updated_at := now();

  RETURN NEW;

END; $$;

-- ---------------------------------------------------------------------

-- 2. AUTHENTICATION AND USERS

-- ---------------------------------------------------------------------

CREATE TABLE users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    email citext NOT NULL UNIQUE,
    password_hash text, -- Argon2/bcrypt hash, NULL while 'invited'
    role user_role NOT NULL DEFAULT 'customer',
    status account_status NOT NULL DEFAULT 'active',
    first_name varchar(100) NOT NULL,
    last_name varchar(100) NOT NULL,
    phone varchar(30),
    email_verified_at timestamptz,
    last_login_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_users_password CHECK (
        status = 'invited'
        OR password_hash IS NOT NULL
    )
);

CREATE TABLE refresh_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash text NOT NULL UNIQUE, -- only the hash is stored
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz,
    ip_address inet,
    user_agent text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens (user_id);

CREATE TABLE one_time_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    type token_type NOT NULL,
    token_hash text NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    used_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_one_time_tokens_user ON one_time_tokens (user_id);

-- Customer-specific data (1:1 with users). A row exists only once the profile is

-- complete, so the FK from reservations guarantees a complete customer record.

CREATE TABLE customer_profiles (
    user_id uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    date_of_birth date NOT NULL,
    address_line varchar(255),
    city varchar(100),
    postal_code varchar(20),
    country char(2),
    license_number varchar(50) NOT NULL,
    license_country char(2) NOT NULL,
    license_issued_on date NOT NULL,
    license_expires_on date NOT NULL,
    CONSTRAINT chk_license_dates CHECK (
        license_expires_on > license_issued_on
    ),
    CONSTRAINT uq_license UNIQUE (
        license_country,
        license_number
    )
);

-- ---------------------------------------------------------------------

-- 3. VEHICLE CATALOGUE

-- ---------------------------------------------------------------------

CREATE TABLE brands (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    name varchar(80) NOT NULL UNIQUE
);

CREATE TABLE categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    name varchar(80) NOT NULL UNIQUE, -- Sedan, SUV, Coupe, Convertible...
    description text
);

CREATE TABLE vehicle_models (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    brand_id uuid NOT NULL REFERENCES brands (id) ON DELETE RESTRICT,
    category_id uuid NOT NULL REFERENCES categories (id) ON DELETE RESTRICT,
    name varchar(100) NOT NULL,
    CONSTRAINT uq_model UNIQUE (brand_id, name)
);

CREATE INDEX idx_vehicle_models_category ON vehicle_models (category_id);


CREATE TABLE vehicles (

  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  model_id         uuid          NOT NULL REFERENCES vehicle_models(id) ON DELETE RESTRICT,

  manufacture_year smallint      NOT NULL CHECK (manufacture_year BETWEEN 1990 AND 2100),

  license_plate    varchar(20)   NOT NULL UNIQUE,

  vin              char(17)      NOT NULL UNIQUE,

  color            varchar(40),

  transmission     transmission_type NOT NULL,

  fuel_type        fuel_type     NOT NULL,

  seats            smallint      NOT NULL DEFAULT 2 CHECK (seats BETWEEN 1 AND 9),

  power_hp         smallint      CHECK (power_hp > 0),

  daily_price      numeric(10,2) NOT NULL CHECK (daily_price > 0),

  security_deposit numeric(10,2) NOT NULL CHECK (security_deposit >= 0),

  mileage_km       integer       NOT NULL DEFAULT 0 CHECK (mileage_km >= 0),

  description      text,

-- Editorial performance data (real-world specifications, shown in the catalogue).

  engine            varchar(120),

  torque_nm         integer       CHECK (torque_nm > 0),

  acceleration_0_100 numeric(4,1) CHECK (acceleration_0_100 > 0),

  top_speed_kmh     smallint      CHECK (top_speed_kmh > 0),

  consumption_l_100km numeric(4,1) CHECK (consumption_l_100km > 0),

-- Edition flags: drive the "special edition" / "limited edition" notifications.

  is_special        boolean       NOT NULL DEFAULT false,

  is_limited        boolean       NOT NULL DEFAULT false,

  edition_size      integer       CHECK (edition_size > 0),

  announced_at      timestamptz   NOT NULL DEFAULT now(),

-- Administrative status only. "Reserved" / "rented" are DERIVED from dates

-- (reservations, rentals) to avoid update anomalies.


status           vehicle_status NOT NULL DEFAULT 'active',

  created_at       timestamptz   NOT NULL DEFAULT now(),

  updated_at       timestamptz   NOT NULL DEFAULT now()

);

CREATE INDEX idx_vehicles_model ON vehicles (model_id);

CREATE INDEX idx_vehicles_status ON vehicles (status);

CREATE TABLE vehicle_images (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    vehicle_id uuid NOT NULL REFERENCES vehicles (id) ON DELETE CASCADE,
    storage_path text NOT NULL,
    media_type media_type NOT NULL DEFAULT 'image',
    poster_path text,
    alt_text varchar(255),
    is_primary boolean NOT NULL DEFAULT false,
    sort_order smallint NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_vehicle_images_vehicle ON vehicle_images (vehicle_id);

CREATE UNIQUE INDEX uq_vehicle_primary_media ON vehicle_images (vehicle_id, media_type)
WHERE
    is_primary;

-- Planned unavailability windows (maintenance, repairs...)

CREATE TABLE vehicle_unavailability (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    vehicle_id uuid NOT NULL REFERENCES vehicles (id) ON DELETE CASCADE,
    starts_at timestamptz NOT NULL,
    ends_at timestamptz NOT NULL,
    period tstzrange GENERATED ALWAYS AS (
        tstzrange (starts_at, ends_at, '[)')
    ) STORED,
    reason unavailability_reason NOT NULL,
    notes text,
    created_by uuid NOT NULL REFERENCES users (id),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_unavail_dates CHECK (ends_at > starts_at),
    CONSTRAINT ex_unavail_no_overlap EXCLUDE USING gist (
        vehicle_id
        WITH
            =,
            period
        WITH
            &&
    )
);

CREATE TABLE notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    type notification_type NOT NULL DEFAULT 'general',
    title varchar(160) NOT NULL,
    message text,
    vehicle_id uuid REFERENCES vehicles (id) ON DELETE CASCADE,
    is_published boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_created ON notifications (created_at DESC);

CREATE INDEX idx_notifications_vehicle ON notifications (vehicle_id);

-- ---------------------------------------------------------------------

-- 4. RESERVATIONS

-- ---------------------------------------------------------------------


CREATE TABLE reservations (

  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  reservation_number varchar(20) NOT NULL UNIQUE

    DEFAULT ('RES-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('reservation_number_seq')::text, 6, '0')),

  customer_id        uuid          NOT NULL REFERENCES customer_profiles(user_id),

  vehicle_id         uuid          NOT NULL REFERENCES vehicles(id),

  pickup_at          timestamptz   NOT NULL,

  return_at          timestamptz   NOT NULL,

  period             tstzrange GENERATED ALWAYS AS (tstzrange(pickup_at, return_at, '[)')) STORED,

-- Price snapshot: later changes to the vehicle price never alter past bookings

rental_days integer NOT NULL CHECK (rental_days > 0),
daily_price numeric(10, 2) NOT NULL CHECK (daily_price > 0),
deposit_amount numeric(10, 2) NOT NULL CHECK (deposit_amount >= 0),
total_amount numeric(12, 2) NOT NULL CHECK (total_amount >= 0),
status reservation_status NOT NULL DEFAULT 'pending',
customer_notes text,
decided_by uuid REFERENCES users (id) ON DELETE SET NULL,
decided_at timestamptz,
decision_reason text,
created_at timestamptz NOT NULL DEFAULT now(),
updated_at timestamptz NOT NULL DEFAULT now(),
CONSTRAINT chk_res_dates CHECK (return_at > pickup_at),
CONSTRAINT chk_res_total CHECK (
    total_amount = rental_days * daily_price
),

-- The database itself forbids double booking, even under concurrent requests


CONSTRAINT ex_res_no_double_booking

    EXCLUDE USING gist (vehicle_id WITH =, period WITH &&)

    WHERE (status IN ('pending', 'confirmed', 'converted'))

);

CREATE INDEX idx_reservations_customer ON reservations (customer_id);

CREATE INDEX idx_reservations_status ON reservations (status, pickup_at);

-- Cross-table rule: a reservation cannot overlap a maintenance window (and vice versa).

-- The vehicle row is locked first so concurrent transactions are serialised per vehicle.

CREATE FUNCTION trg_reservation_vs_unavailability() RETURNS trigger LANGUAGE plpgsql AS $$

BEGIN

  IF NEW.status IN ('pending', 'confirmed', 'converted') THEN

    PERFORM 1 FROM vehicles WHERE id = NEW.vehicle_id FOR UPDATE;

    IF EXISTS (SELECT 1 FROM vehicle_unavailability u

               WHERE u.vehicle_id = NEW.vehicle_id

                 AND u.period && tstzrange(NEW.pickup_at, NEW.return_at, '[)')) THEN

      RAISE EXCEPTION 'Vehicle % is unavailable during the requested period', NEW.vehicle_id

        USING ERRCODE = '23P01';

    END IF;

  END IF;

  RETURN NEW;

END; $$;

CREATE TRIGGER trg_reservations_vs_unavailability

  BEFORE INSERT OR UPDATE OF vehicle_id, pickup_at, return_at, status ON reservations

  FOR EACH ROW EXECUTE FUNCTION trg_reservation_vs_unavailability();

CREATE FUNCTION trg_unavailability_vs_reservation() RETURNS trigger LANGUAGE plpgsql AS $$

BEGIN

  PERFORM 1 FROM vehicles WHERE id = NEW.vehicle_id FOR UPDATE;

  IF EXISTS (SELECT 1 FROM reservations r

             WHERE r.vehicle_id = NEW.vehicle_id

               AND r.status IN ('pending', 'confirmed', 'converted')

               AND r.period && tstzrange(NEW.starts_at, NEW.ends_at, '[)')) THEN

    RAISE EXCEPTION 'Vehicle % has reservations during this period', NEW.vehicle_id

      USING ERRCODE = '23P01';

  END IF;

  RETURN NEW;

END; $$;

CREATE TRIGGER trg_unavailability_vs_reservations

  BEFORE INSERT OR UPDATE OF vehicle_id, starts_at, ends_at ON vehicle_unavailability

  FOR EACH ROW EXECUTE FUNCTION trg_unavailability_vs_reservation();

-- ---------------------------------------------------------------------

-- 5. RENTALS, INSPECTIONS, RETURN

-- ---------------------------------------------------------------------


CREATE TABLE rentals (

  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  contract_number    varchar(20) NOT NULL UNIQUE

    DEFAULT ('CTR-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('contract_number_seq')::text, 6, '0')),

  reservation_id     uuid        NOT NULL UNIQUE REFERENCES reservations(id),  -- 1 reservation -> max 1 rental

  status             rental_status NOT NULL DEFAULT 'active',

  started_at         timestamptz NOT NULL DEFAULT now(),

  expected_return_at timestamptz NOT NULL,

  returned_at        timestamptz,

  closed_at          timestamptz,

  opened_by          uuid        NOT NULL REFERENCES users(id),

  closed_by          uuid        REFERENCES users(id),

  notes              text,

  created_at         timestamptz NOT NULL DEFAULT now(),

  updated_at         timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT chk_rental_dates CHECK (expected_return_at > started_at),

-- Lifecycle consistency: active -> returned -> closed


CONSTRAINT chk_rental_lifecycle CHECK (

       (status = 'active'   AND returned_at IS NULL     AND closed_at IS NULL)

    OR (status = 'returned' AND returned_at IS NOT NULL AND closed_at IS NULL)

    OR (status = 'closed'   AND returned_at IS NOT NULL AND closed_at IS NOT NULL))

);

CREATE INDEX idx_rentals_status ON rentals (status, expected_return_at);

-- One table for both vehicle check-out (handover) and check-in (return)

CREATE TABLE inspections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    rental_id uuid NOT NULL REFERENCES rentals (id) ON DELETE CASCADE,
    type inspection_type NOT NULL,
    performed_at timestamptz NOT NULL DEFAULT now(),
    performed_by uuid NOT NULL REFERENCES users (id),
    mileage_km integer NOT NULL CHECK (mileage_km >= 0),
    fuel_level_pct smallint NOT NULL CHECK (
        fuel_level_pct BETWEEN 0 AND 100
    ),
    overall_condition condition_rating NOT NULL,
    notes text,
    CONSTRAINT uq_inspection_per_type UNIQUE (rental_id, type)
);

CREATE TABLE inspection_damages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    inspection_id uuid NOT NULL REFERENCES inspections (id) ON DELETE CASCADE,
    vehicle_zone varchar(60) NOT NULL, -- e.g. front bumper, left door
    description text NOT NULL,
    severity damage_severity NOT NULL,
    estimated_repair_cost numeric(10, 2) CHECK (estimated_repair_cost >= 0),
    photo_path text
);

CREATE INDEX idx_damages_inspection ON inspection_damages (inspection_id);

-- Return mileage must be >= handover mileage, and a handover must exist first

CREATE FUNCTION trg_inspection_mileage() RETURNS trigger LANGUAGE plpgsql AS $$

DECLARE start_km integer;

BEGIN

  IF NEW.type = 'return' THEN

    SELECT mileage_km INTO start_km FROM inspections

     WHERE rental_id = NEW.rental_id AND type = 'handover';

    IF start_km IS NULL THEN

      RAISE EXCEPTION 'A handover inspection is required before the return inspection';

    END IF;

    IF NEW.mileage_km < start_km THEN

      RAISE EXCEPTION 'Return mileage (%) is lower than handover mileage (%)', NEW.mileage_km, start_km;

    END IF;

  END IF;

  RETURN NEW;

END; $$;

CREATE TRIGGER trg_inspections_mileage

  BEFORE INSERT ON inspections

  FOR EACH ROW EXECUTE FUNCTION trg_inspection_mileage();

-- ---------------------------------------------------------------------

-- 6. MONEY: DEPOSITS, PAYMENTS, CHARGES, INVOICES

-- ---------------------------------------------------------------------

CREATE TABLE security_deposits (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    rental_id uuid NOT NULL UNIQUE REFERENCES rentals (id) ON DELETE CASCADE,
    amount numeric(10, 2) NOT NULL CHECK (amount >= 0),
    status deposit_status NOT NULL DEFAULT 'pending',
    retained_amount numeric(10, 2) NOT NULL DEFAULT 0 CHECK (retained_amount >= 0),
    retention_reason text,
    held_at timestamptz,
    released_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_retained_le_amount CHECK (retained_amount <= amount),
    CONSTRAINT chk_retention_reason CHECK (
        retained_amount = 0
        OR retention_reason IS NOT NULL
    )
);

-- Append-only ledger: corrections are made by adding refund entries, never by editing

CREATE TABLE payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    rental_id uuid NOT NULL REFERENCES rentals (id) ON DELETE RESTRICT,
    type payment_type NOT NULL,
    method payment_method NOT NULL,
    amount numeric(12, 2) NOT NULL CHECK (amount > 0),
    currency char(3) NOT NULL DEFAULT 'EUR',
    paid_at timestamptz NOT NULL DEFAULT now(),
    reference varchar(100),
    recorded_by uuid NOT NULL REFERENCES users (id),
    notes text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_rental ON payments (rental_id);

CREATE INDEX idx_payments_paid_at ON payments (paid_at);

CREATE TABLE additional_charges (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    rental_id uuid NOT NULL REFERENCES rentals (id) ON DELETE CASCADE,
    type charge_type NOT NULL,
    description varchar(255) NOT NULL,
    amount numeric(10, 2) NOT NULL CHECK (amount > 0),
    inspection_damage_id uuid REFERENCES inspection_damages (id) ON DELETE SET NULL,
    created_by uuid NOT NULL REFERENCES users (id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_charges_rental ON additional_charges (rental_id);

CREATE TABLE invoices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    invoice_number varchar(20) UNIQUE, -- assigned at issue time -> gapless numbering
    rental_id uuid NOT NULL REFERENCES rentals (id) ON DELETE RESTRICT,
    status invoice_status NOT NULL DEFAULT 'draft',
    currency char(3) NOT NULL DEFAULT 'EUR',
    subtotal numeric(12, 2) NOT NULL CHECK (subtotal >= 0),
    tax_rate numeric(5, 2) NOT NULL DEFAULT 0 CHECK (tax_rate BETWEEN 0 AND 100),
    tax_amount numeric(12, 2) NOT NULL CHECK (tax_amount >= 0),
    total_amount numeric(12, 2) NOT NULL,
    issued_at timestamptz,
    issued_by uuid REFERENCES users (id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_invoice_total CHECK (
        total_amount = subtotal + tax_amount
    ),
    CONSTRAINT chk_invoice_issued CHECK (
        status = 'draft'
        OR (
            invoice_number IS NOT NULL
            AND issued_at IS NOT NULL
        )
    )
);

CREATE INDEX idx_invoices_rental ON invoices (rental_id);

CREATE TABLE invoice_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    invoice_id uuid NOT NULL REFERENCES invoices (id) ON DELETE CASCADE,
    description varchar(255) NOT NULL,
    quantity numeric(10, 2) NOT NULL CHECK (quantity > 0),
    unit_price numeric(10, 2) NOT NULL CHECK (unit_price >= 0),
    line_total numeric(12, 2) GENERATED ALWAYS AS (
        round(quantity * unit_price, 2)
    ) STORED,
    additional_charge_id uuid REFERENCES additional_charges (id) ON DELETE SET NULL
);

CREATE INDEX idx_invoice_items_invoice ON invoice_items (invoice_id);

-- ---------------------------------------------------------------------

-- 7. DOCUMENTS AND AUDIT

-- ---------------------------------------------------------------------

-- PDF files live on disk / object storage; the DB keeps metadata and an integrity hash

CREATE TABLE documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    rental_id uuid NOT NULL REFERENCES rentals (id) ON DELETE CASCADE,
    invoice_id uuid REFERENCES invoices (id) ON DELETE SET NULL,
    type document_type NOT NULL,
    file_name varchar(255) NOT NULL,
    storage_path text NOT NULL UNIQUE,
    mime_type varchar(100) NOT NULL DEFAULT 'application/pdf',
    size_bytes integer NOT NULL CHECK (size_bytes > 0),
    sha256 char(64) NOT NULL,
    generated_by uuid NOT NULL REFERENCES users (id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_documents_rental ON documents (rental_id);

CREATE TABLE audit_logs (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    actor_id uuid REFERENCES users (id) ON DELETE SET NULL,
    action varchar(50) NOT NULL, -- e.g. RESERVATION_CONFIRMED
    entity_type varchar(50) NOT NULL,
    entity_id uuid,
    old_values jsonb,
    new_values jsonb,
    ip_address inet,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_entity ON audit_logs (entity_type, entity_id);

CREATE INDEX idx_audit_actor ON audit_logs (actor_id, created_at DESC);

-- ---------------------------------------------------------------------

-- 8. updated_at TRIGGERS

-- ---------------------------------------------------------------------

DO $$

DECLARE t text;

BEGIN

  FOREACH t IN ARRAY ARRAY['users','vehicles','reservations','rentals','security_deposits','invoices'] LOOP

    EXECUTE format(

      'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %I

         FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t, t);

  END LOOP;

END; $$;



-- ---------------------------------------------------------------------

-- 9. AVAILABILITY QUERY AND DASHBOARD VIEWS

-- ---------------------------------------------------------------------

-- Vehicles that can be booked for [p_from, p_to)

CREATE FUNCTION find_available_vehicles(p_from timestamptz, p_to timestamptz)

RETURNS SETOF vehicles LANGUAGE sql STABLE AS $$

  SELECT v.*

  FROM vehicles v

  WHERE v.status = 'active'

    AND NOT EXISTS (

      SELECT 1 FROM reservations r

      WHERE r.vehicle_id = v.id

        AND r.status IN ('pending', 'confirmed', 'converted')

        AND r.period && tstzrange(p_from, p_to, '[)'))

    AND NOT EXISTS (

      SELECT 1 FROM vehicle_unavailability u

      WHERE u.vehicle_id = v.id

        AND u.period && tstzrange(p_from, p_to, '[)'));

$$;

CREATE VIEW v_dashboard_summary AS

SELECT (
        SELECT count(*)
        FROM vehicles
        WHERE
            status = 'active'
    ) AS active_vehicles,
    (
        SELECT count(*)
        FROM reservations
        WHERE
            status = 'pending'
    ) AS pending_reservations,
    (
        SELECT count(*)
        FROM rentals
        WHERE
            status = 'active'
    ) AS active_rentals,
    (
        SELECT count(*)
        FROM rentals
        WHERE
            status = 'active'
            AND expected_return_at < now()
    ) AS overdue_rentals,
    (
        SELECT count(*)
        FROM users
        WHERE
            role = 'customer'
    ) AS customers;

-- Deposits are excluded from revenue: they are held funds, not income

CREATE VIEW v_monthly_revenue AS

SELECT date_trunc ('month', paid_at) AS month, sum(
        CASE
            WHEN type IN (
                'rental_payment', 'charge_payment'
            ) THEN amount
            WHEN type = 'refund' THEN - amount
            ELSE 0
        END
    ) AS revenue
FROM payments
GROUP BY
    1
ORDER BY 1;

