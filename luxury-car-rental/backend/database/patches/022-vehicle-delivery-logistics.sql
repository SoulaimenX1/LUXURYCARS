-- ============================================================
-- 022 - VEHICLE DELIVERY & COLLECTION LOGISTICS (ADDITIVE ONLY)
--   No DROP TABLE / TRUNCATE / destructive change.
--   Every statement is idempotent (IF NOT EXISTS or pg_constraint guard).
--   Provenance of seeded values is documented in notes columns.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Service locations: extend existing rental_locations
--    (ISO country, kind vocabulary, coordinates, instructions)
-- ------------------------------------------------------------

ALTER TABLE rental_locations
  ADD COLUMN IF NOT EXISTS country_code char(2);

ALTER TABLE rental_locations
  ADD COLUMN IF NOT EXISTS kind varchar(24);

ALTER TABLE rental_locations
  ADD COLUMN IF NOT EXISTS latitude numeric(9,6);

ALTER TABLE rental_locations
  ADD COLUMN IF NOT EXISTS longitude numeric(9,6);

ALTER TABLE rental_locations
  ADD COLUMN IF NOT EXISTS instructions text;

-- Backfill factual existing data only (all live rows are country='Hongrie').
UPDATE rental_locations
   SET country_code = 'HU'
 WHERE country_code IS NULL
   AND country IN ('Hongrie', 'Hungary');

-- Backfill kind from the existing category vocabulary.
UPDATE rental_locations
   SET kind = CASE category
                 WHEN 'showroom'    THEN 'SHOWROOM'
                 WHEN 'airport'     THEN 'AIRPORT'
                 WHEN 'hotel'       THEN 'HOTEL'
                 ELSE 'APPROVED_POINT'
               END
 WHERE kind IS NULL;

-- Default keeps legacy INSERT paths (old DTO) working; admin DTO sets explicitly.
ALTER TABLE rental_locations ALTER COLUMN kind SET DEFAULT 'APPROVED_POINT';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_rental_locations_kind') THEN
    ALTER TABLE rental_locations
      ADD CONSTRAINT chk_rental_locations_kind
      CHECK (kind IN ('AGENCY','SHOWROOM','APPROVED_POINT','AIRPORT','HOTEL','PARKING','CUSTOMER_ADDRESS'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_rental_locations_country_code') THEN
    ALTER TABLE rental_locations
      ADD CONSTRAINT chk_rental_locations_country_code
      CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$');
  END IF;
END $$;

-- Exception calendar (holidays / special hours) per location.
CREATE TABLE IF NOT EXISTS location_hours (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES rental_locations (id) ON DELETE CASCADE,
  date        date NOT NULL,
  is_closed   boolean NOT NULL DEFAULT true,
  opens_at    time,
  closes_at   time,
  note        varchar(250),
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_location_hours UNIQUE (location_id, date),
  CONSTRAINT chk_location_hours_open CHECK (NOT is_closed AND opens_at IS NOT NULL AND closes_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_location_hours_date ON location_hours (date);

-- ------------------------------------------------------------
-- 2. Service zones (explicit geography = country + optional city
--    list; empty list = whole country. No radius / ETA claims.)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS service_zones (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                    varchar(50) NOT NULL UNIQUE,
  name                    varchar(120) NOT NULL,
  country_code            char(2) NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
  active                  boolean NOT NULL DEFAULT false,
  address_service_enabled boolean NOT NULL DEFAULT false,
  cities                  jsonb NOT NULL DEFAULT '[]'::jsonb,
  timezone                varchar(50) NOT NULL DEFAULT 'Europe/Budapest',
  opens_at                time NOT NULL DEFAULT '09:00:00',
  closes_at               time NOT NULL DEFAULT '18:00:00',
  lead_time_minutes       integer NOT NULL DEFAULT 0 CHECK (lead_time_minutes >= 0),
  cutoff_time             time,
  after_hours_allowed     boolean NOT NULL DEFAULT false,
  holiday_exceptions      jsonb NOT NULL DEFAULT '[]'::jsonb,
  fleet_restrictions      jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes                   text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_service_zones_hours CHECK (closes_at > opens_at)
);

-- Seeded from the existing Hungary-only location set (patch 017).
-- ON CONFLICT DO NOTHING => never overwrites admin edits on re-run.
INSERT INTO service_zones
  (code, name, country_code, active, address_service_enabled, cities, timezone, opens_at, closes_at, notes)
VALUES
  ('HU-ALL', 'Hungary - national service zone', 'HU', true, true,
   '[]'::jsonb, 'Europe/Budapest', '09:00:00', '18:00:00',
   'Seeded by migration 022 from the existing Hungary-only location set (patch 017). Default hours mirror the rental_locations schema defaults. Empty cities list = whole country; add city names to restrict. Confirm hours, lead time and cutoff with the business owner before launch.')
ON CONFLICT (code) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_service_zones_updated_at') THEN
    CREATE TRIGGER trg_service_zones_updated_at
      BEFORE UPDATE ON service_zones
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- ------------------------------------------------------------
-- 3. Delivery pricing rules (server-authoritative, draft until
--    an approved fee is set; no invented amounts).
--    fee_mode 'formula' reserved: zone/distance/provider modes
--    are NOT implemented (would require a paid integration).
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS delivery_pricing_rules (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id      uuid NOT NULL REFERENCES service_zones (id) ON DELETE CASCADE,
  service_type varchar(24) NOT NULL CHECK (service_type IN ('door_pickup','door_dropoff','reposition')),
  fee_mode     varchar(16) NOT NULL DEFAULT 'fixed' CHECK (fee_mode IN ('fixed','formula')),
  fixed_fee    numeric(10,2) CHECK (fixed_fee >= 0),
  currency     char(3) NOT NULL DEFAULT 'EUR',
  minimum_fee  numeric(10,2) CHECK (minimum_fee >= 0),
  modifiers    jsonb NOT NULL DEFAULT '{}'::jsonb,
  status       varchar(12) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','retired')),
  effective_from timestamptz,
  effective_to   timestamptz,
  notes        varchar(500),
  created_by   uuid REFERENCES users (id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_delivery_pricing_window CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_to > effective_from)
);

-- Only one ACTIVE rule per (zone, service_type).
CREATE UNIQUE INDEX IF NOT EXISTS uq_delivery_pricing_active
  ON delivery_pricing_rules (zone_id, service_type)
  WHERE status = 'active';

-- Draft placeholders for the seeded zone (re-run safe).
INSERT INTO delivery_pricing_rules (zone_id, service_type, status, notes)
SELECT z.id, t.service_type, 'draft',
       'Draft placeholder created by migration 022. Set an approved fixed_fee and switch status to ''active'' to enable door delivery quoting.'
  FROM service_zones z
  CROSS JOIN (VALUES ('door_pickup'), ('door_dropoff')) AS t (service_type)
 WHERE z.code = 'HU-ALL'
   AND NOT EXISTS (
         SELECT 1 FROM delivery_pricing_rules d
          WHERE d.zone_id = z.id AND d.service_type = t.service_type
       );

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_delivery_pricing_rules_updated_at') THEN
    CREATE TRIGGER trg_delivery_pricing_rules_updated_at
      BEFORE UPDATE ON delivery_pricing_rules
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- ------------------------------------------------------------
-- 4. Reservation pickup/return service points (contractual
--    snapshots) + append-only revision history.
--    Legacy rows are untouched: reservations created before 022
--    have no rows here and keep using reservation_preferences.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS reservation_service_points (
  reservation_id       uuid NOT NULL REFERENCES reservations (id) ON DELETE CASCADE,
  direction            varchar(16) NOT NULL CHECK (direction IN ('pickup','dropoff')),
  method               varchar(20) NOT NULL CHECK (method IN ('APPROVED_POINT','DOOR_TO_DOOR')),
  location_id          uuid REFERENCES rental_locations (id),
  address              jsonb,
  scheduled_at         timestamptz NOT NULL,
  local_date           date NOT NULL,
  local_time           time NOT NULL,
  timezone             varchar(50) NOT NULL,
  meeting_instructions varchar(500),
  entry_notes          text,
  canonical            varchar(500) NOT NULL,
  frozen               boolean NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (reservation_id, direction),
  CONSTRAINT chk_service_point_shape CHECK (
    (method = 'APPROVED_POINT' AND location_id IS NOT NULL AND address IS NULL)
    OR (method = 'DOOR_TO_DOOR' AND location_id IS NULL AND address IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_service_points_location
  ON reservation_service_points (location_id);

CREATE TABLE IF NOT EXISTS reservation_service_point_revisions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL,
  direction      varchar(16) NOT NULL,
  revision       integer NOT NULL,
  snapshot       jsonb NOT NULL,
  changed_by     uuid REFERENCES users (id),
  reason         varchar(250),
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_service_point_revision UNIQUE (reservation_id, direction, revision),
  CONSTRAINT fk_service_point_revision FOREIGN KEY (reservation_id, direction)
    REFERENCES reservation_service_points (reservation_id, direction) ON DELETE CASCADE
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_reservation_service_points_updated_at') THEN
    CREATE TRIGGER trg_reservation_service_points_updated_at
      BEFORE UPDATE ON reservation_service_points
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- ------------------------------------------------------------
-- 5. Transport missions + append-only mission events.
--    Mission-vs-reservation vehicle overlap is enforced
--    application-side with FOR UPDATE (two different tables);
--    driver and mission vehicle overlaps get DB exclusions below.
-- ------------------------------------------------------------

CREATE SEQUENCE IF NOT EXISTS transport_mission_number_seq;

CREATE TABLE IF NOT EXISTS transport_missions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_number     varchar(20) NOT NULL UNIQUE
                       DEFAULT ('TM-' || lpad(nextval('transport_mission_number_seq')::text, 6, '0')),
  type               varchar(16) NOT NULL CHECK (type IN ('DELIVERY','COLLECTION','REPOSITIONING')),
  reservation_id     uuid REFERENCES reservations (id),
  vehicle_id         uuid NOT NULL REFERENCES vehicles (id),
  origin_kind        varchar(16) NOT NULL CHECK (origin_kind IN ('LOCATION','ADDRESS')),
  origin_location_id uuid REFERENCES rental_locations (id),
  origin_address     jsonb,
  destination_kind        varchar(16) NOT NULL CHECK (destination_kind IN ('LOCATION','ADDRESS')),
  destination_location_id uuid REFERENCES rental_locations (id),
  destination_address     jsonb,
  planned_start      timestamptz NOT NULL,
  planned_end        timestamptz NOT NULL,
  assigned_driver_id uuid REFERENCES users (id),
  state              varchar(20) NOT NULL DEFAULT 'created'
                       CHECK (state IN ('created','assigned','accepted','in_progress','paused','completed','cancelled','failed')),
  issue_flags        jsonb NOT NULL DEFAULT '[]'::jsonb,
  distance_km        numeric(8,2) CHECK (distance_km IS NULL OR distance_km >= 0),
  evidence           jsonb NOT NULL DEFAULT '{}'::jsonb,
  revision           integer NOT NULL DEFAULT 1 CHECK (revision >= 1),
  created_by         uuid REFERENCES users (id),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_missions_window CHECK (planned_end > planned_start),
  CONSTRAINT chk_missions_points_shape CHECK (
    (origin_kind = 'LOCATION' AND origin_location_id IS NOT NULL AND origin_address IS NULL)
    OR (origin_kind = 'ADDRESS' AND origin_location_id IS NULL AND origin_address IS NOT NULL)
  ),
  CONSTRAINT chk_missions_dest_shape CHECK (
    (destination_kind = 'LOCATION' AND destination_location_id IS NOT NULL AND destination_address IS NULL)
    OR (destination_kind = 'ADDRESS' AND destination_location_id IS NULL AND destination_address IS NOT NULL)
  ),
  CONSTRAINT chk_missions_reservation_required CHECK (
    reservation_id IS NOT NULL OR type = 'REPOSITIONING'
  )
);

CREATE INDEX IF NOT EXISTS idx_missions_state ON transport_missions (state);
CREATE INDEX IF NOT EXISTS idx_missions_vehicle ON transport_missions (vehicle_id);
CREATE INDEX IF NOT EXISTS idx_missions_driver ON transport_missions (assigned_driver_id);
CREATE INDEX IF NOT EXISTS idx_missions_window ON transport_missions (planned_start, planned_end);
CREATE INDEX IF NOT EXISTS idx_missions_reservation ON transport_missions (reservation_id);

-- Driver cannot occupy two active missions in the same window.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ex_missions_driver_no_overlap') THEN
    ALTER TABLE transport_missions
      ADD CONSTRAINT ex_missions_driver_no_overlap
      EXCLUDE USING gist (
        assigned_driver_id WITH =,
        tstzrange(planned_start, planned_end) WITH &&
      )
      WHERE (assigned_driver_id IS NOT NULL
             AND state IN ('created','assigned','accepted','in_progress','paused'));
  END IF;
END $$;

-- A vehicle cannot be on two active missions in the same window.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ex_missions_vehicle_no_overlap') THEN
    ALTER TABLE transport_missions
      ADD CONSTRAINT ex_missions_vehicle_no_overlap
      EXCLUDE USING gist (
        vehicle_id WITH =,
        tstzrange(planned_start, planned_end) WITH &&
      )
      WHERE (state IN ('created','assigned','accepted','in_progress','paused'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS mission_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id      uuid NOT NULL REFERENCES transport_missions (id) ON DELETE CASCADE,
  seq             integer NOT NULL,
  from_state      varchar(20),
  to_state        varchar(20),
  event_type      varchar(40) NOT NULL,
  actor_id        uuid REFERENCES users (id),
  actor_role      varchar(16),
  server_ts       timestamptz NOT NULL DEFAULT now(),
  reason          text,
  evidence        jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key varchar(120),
  CONSTRAINT uq_mission_event_seq UNIQUE (mission_id, seq)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_mission_event_idempotency
  ON mission_events (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_transport_missions_updated_at') THEN
    CREATE TRIGGER trg_transport_missions_updated_at
      BEFORE UPDATE ON transport_missions
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- ------------------------------------------------------------
-- 6. Driver profiles + shifts (staff-role users).
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS driver_profiles (
  user_id               uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  service_country_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  vehicle_groups        jsonb NOT NULL DEFAULT '[]'::jsonb,
  active                boolean NOT NULL DEFAULT false,
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS driver_shifts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id    uuid NOT NULL REFERENCES driver_profiles (user_id) ON DELETE CASCADE,
  kind         varchar(12) NOT NULL DEFAULT 'shift' CHECK (kind IN ('shift','absence')),
  starts_at    timestamptz NOT NULL,
  ends_at      timestamptz NOT NULL,
  country_code char(2) CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$'),
  capacity     integer NOT NULL DEFAULT 1 CHECK (capacity >= 0),
  notes        varchar(250),
  created_by   uuid REFERENCES users (id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_driver_shifts_window CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_driver_shifts_driver_window ON driver_shifts (driver_id, starts_at, ends_at);

-- No overlapping shift/absence rows for the same driver.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ex_driver_shifts_no_overlap') THEN
    ALTER TABLE driver_shifts
      ADD CONSTRAINT ex_driver_shifts_no_overlap
      EXCLUDE USING gist (driver_id WITH =, tstzrange(starts_at, ends_at) WITH &&);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_driver_profiles_updated_at') THEN
    CREATE TRIGGER trg_driver_profiles_updated_at
      BEFORE UPDATE ON driver_profiles
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- ------------------------------------------------------------
-- 7. Vehicle physical location ledger + projection columns.
--    current_location_id is NULL = "untracked" (explicit state,
--    never invented); maintained transactionally by the service.
-- ------------------------------------------------------------

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS home_location_id uuid REFERENCES rental_locations (id);

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS current_location_id uuid REFERENCES rental_locations (id);

CREATE TABLE IF NOT EXISTS vehicle_location_events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id       uuid NOT NULL REFERENCES vehicles (id) ON DELETE CASCADE,
  event_kind       varchar(24) NOT NULL CHECK (event_kind IN
                    ('reservation_pickup','reservation_return','mission_parked_confirmed',
                     'mission_reposition','admin_manual','maintenance','correction')),
  occurred_at      timestamptz NOT NULL DEFAULT now(),
  from_location_id uuid REFERENCES rental_locations (id),
  to_location_id   uuid REFERENCES rental_locations (id),
  from_address     jsonb,
  to_address       jsonb,
  mission_id       uuid REFERENCES transport_missions (id),
  reservation_id   uuid REFERENCES reservations (id),
  rental_id        uuid REFERENCES rentals (id),
  actor_id         uuid REFERENCES users (id),
  source           varchar(16) NOT NULL DEFAULT 'system' CHECK (source IN ('system','driver','admin')),
  verified_at      timestamptz,
  note             text
);

CREATE INDEX IF NOT EXISTS idx_vehicle_location_events_vehicle_time
  ON vehicle_location_events (vehicle_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_vehicle_location_events_mission
  ON vehicle_location_events (mission_id) WHERE mission_id IS NOT NULL;

-- ------------------------------------------------------------
-- 8. Handover evidence: link inspections to missions (nullable).
-- ------------------------------------------------------------

ALTER TABLE inspections
  ADD COLUMN IF NOT EXISTS transport_mission_id uuid REFERENCES transport_missions (id);

-- ------------------------------------------------------------
-- 9. Delivery quotes: immutable server-side snapshots.
--    Extends premium.quote(); never replaces reservations totals.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS delivery_quotes (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_for            uuid REFERENCES users (id),
  vehicle_id             uuid NOT NULL REFERENCES vehicles (id),
  pickup_at              timestamptz NOT NULL,
  return_at              timestamptz NOT NULL,
  zone_id                uuid REFERENCES service_zones (id),
  pickup_method          varchar(20) NOT NULL CHECK (pickup_method IN ('APPROVED_POINT','DOOR_TO_DOOR')),
  dropoff_method         varchar(20) NOT NULL CHECK (dropoff_method IN ('APPROVED_POINT','DOOR_TO_DOOR')),
  pickup_point           jsonb NOT NULL,
  dropoff_point          jsonb NOT NULL,
  breakdown              jsonb NOT NULL,
  policy_version         integer NOT NULL DEFAULT 1 CHECK (policy_version >= 1),
  status                 varchar(12) NOT NULL DEFAULT 'issued'
                           CHECK (status IN ('issued','accepted','expired','superseded')),
  calculated_at          timestamptz NOT NULL DEFAULT now(),
  expires_at             timestamptz NOT NULL,
  accepted_reservation_id uuid REFERENCES reservations (id),
  created_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_delivery_quote_window CHECK (return_at > pickup_at),
  CONSTRAINT chk_delivery_quote_expiry CHECK (expires_at > calculated_at)
);

CREATE INDEX IF NOT EXISTS idx_delivery_quotes_creator ON delivery_quotes (created_for, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_quotes_status ON delivery_quotes (status, expires_at);
