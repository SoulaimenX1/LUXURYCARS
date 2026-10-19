-- Expérience client premium : migration idempotente, sans données personnelles de démonstration.
CREATE TABLE IF NOT EXISTS favorite_vehicles (
 customer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(customer_id, vehicle_id)
);
CREATE TABLE IF NOT EXISTS vehicle_reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 customer_id uuid NOT NULL REFERENCES users(id),
 rental_id uuid NOT NULL UNIQUE REFERENCES rentals(id),
 vehicle_id uuid NOT NULL REFERENCES vehicles(id),
 rating smallint NOT NULL CHECK(rating BETWEEN 1 AND 5),
 title varchar(100) NOT NULL,
 comment varchar(1500) NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reviews_vehicle ON vehicle_reviews(vehicle_id, created_at DESC);
CREATE TABLE IF NOT EXISTS premium_extras (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 code varchar(40) NOT NULL UNIQUE,
 name varchar(100) NOT NULL,
 description varchar(500),
 category varchar(20) NOT NULL CHECK(category IN ('equipment','driver','protection')),
 pricing varchar(10) NOT NULL CHECK(pricing IN ('daily','once')),
 amount numeric(10,2) NOT NULL CHECK(amount >= 0),
 enabled boolean NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS premium_promotions (
 code varchar(30) PRIMARY KEY,
 percentage smallint NOT NULL CHECK(percentage BETWEEN 1 AND 50),
 starts_at timestamptz NOT NULL,
 expires_at timestamptz NOT NULL,
 max_uses integer CHECK(max_uses > 0),
 uses integer NOT NULL DEFAULT 0 CHECK(uses >= 0),
 enabled boolean NOT NULL DEFAULT true,
 CONSTRAINT chk_promotion_dates CHECK(expires_at > starts_at)
);
CREATE TABLE IF NOT EXISTS reservation_extras (
 reservation_id uuid NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
 extra_id uuid NOT NULL REFERENCES premium_extras(id),
 name_snapshot varchar(100) NOT NULL,
 amount_snapshot numeric(10,2) NOT NULL,
 pricing_snapshot varchar(10) NOT NULL DEFAULT 'once' CHECK(pricing_snapshot IN ('once','daily')),
 unit_price_snapshot numeric(10,2) NOT NULL DEFAULT 0 CHECK(unit_price_snapshot >= 0),
 PRIMARY KEY(reservation_id, extra_id)
);
CREATE TABLE IF NOT EXISTS reservation_preferences (
 reservation_id uuid PRIMARY KEY REFERENCES reservations(id) ON DELETE CASCADE,
 pickup_method varchar(15) NOT NULL DEFAULT 'branch' CHECK (pickup_method IN ('branch','airport','hotel')),
 delivery_address varchar(250),
 delivery_status varchar(15) NOT NULL DEFAULT 'requested' CHECK(delivery_status IN ('requested','accepted','rejected')),
 checkin_at timestamptz,
 checkin_notes varchar(500),
 CONSTRAINT chk_delivery_address CHECK(pickup_method != 'hotel' OR nullif(trim(delivery_address),'') IS NOT NULL)
);
CREATE TABLE IF NOT EXISTS customer_email_outbox (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 customer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 subject varchar(200) NOT NULL,
 message text NOT NULL,
 status varchar(12) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sent','failed')),
 created_at timestamptz NOT NULL DEFAULT now(),
 sent_at timestamptz
);
-- Montants des options et de la remise figés lors de la réservation.
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS extras_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK(extras_amount >= 0);
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS discount_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK(discount_amount >= 0);
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS delivery_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK(delivery_amount >= 0);
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS promotion_code varchar(30);
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS chk_res_total;
ALTER TABLE reservations ADD CONSTRAINT chk_res_total CHECK (
 total_amount = rental_days * daily_price + extras_amount + delivery_amount - discount_amount
 AND discount_amount <= rental_days * daily_price + extras_amount + delivery_amount
);
-- Les frais de livraison sont des estimations fixes, définies par l'entreprise, pas des distances calculées.
INSERT INTO premium_extras (code,name,description,category,pricing,amount)
VALUES
 ('EXTRA_DRIVER','Additional driver','Second authorised driver, subject to licence checks','driver','daily',15.00),
 ('CHILD_SEAT','Child safety seat','Child seat available on request','equipment','once',25.00),
 ('GPS','GPS navigation','Navigation accessory on request','equipment','once',15.00),
 ('PROTECTION_PLUS','Additional protection','Optional additional protection; coverage subject to rental terms','protection','daily',30.00)
ON CONFLICT(code) DO NOTHING;
