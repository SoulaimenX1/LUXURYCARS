-- ==============================================================
-- 014 — AVIS ÉDITORIAUX « MAISON »
-- ==============================================================
-- Avis rédigés par la maison, affichés sur la fiche véhicule en
-- complément des avis clients vérifiés (vehicle_reviews).
-- Migration additive et idempotente : aucune donnée n'est supprimée.
-- ==============================================================

CREATE TABLE IF NOT EXISTS vehicle_editorial_reviews (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id   uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  language     char(2) NOT NULL DEFAULT 'en',
  headline     varchar(160) NOT NULL,
  body         text NOT NULL,
  verdict      varchar(240),
  source       varchar(60) NOT NULL DEFAULT 'MAISON',
  sort_order   smallint NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_editorial_review_vehicle_language UNIQUE (vehicle_id, language),
  CONSTRAINT chk_editorial_headline CHECK (length(btrim(headline)) > 0),
  CONSTRAINT chk_editorial_body     CHECK (length(btrim(body)) > 0),
  CONSTRAINT chk_editorial_language CHECK (language ~ '^[a-z]{2}$')
);

CREATE INDEX IF NOT EXISTS idx_editorial_reviews_vehicle
  ON vehicle_editorial_reviews(vehicle_id) WHERE is_published;

DROP TRIGGER IF EXISTS trg_editorial_reviews_updated ON vehicle_editorial_reviews;
CREATE TRIGGER trg_editorial_reviews_updated BEFORE UPDATE ON vehicle_editorial_reviews
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ==============================================================
-- SEED — 12 avis sur des véhicules ACTIFS (visibles au catalogue).
-- Résolus par marque + modèle pour rester portables entre bases.
-- ==============================================================

INSERT INTO vehicle_editorial_reviews (vehicle_id, language, headline, body, verdict, sort_order)
SELECT v.id, 'en',
  $txt$The fastest of the fast — four hundred and forty kilometres per hour$txt$,
  $txt$The Chiron Super Sport 300+ is the ultimate expression of the Bugatti legend. Its 8.0-litre quad-turbo W16 produces 1,600 hp, a figure that rewrites what a road car can do: 0-100 km/h in 2.3 seconds and a top speed in excess of 440 km/h. Yet astonishingly it is also a grand tourer — hand-stitched leather, polished aluminium and a cabin as serene as it is opulent. This is hypercar royalty, and nothing else compares.$txt$,
  $txt$Perfect for the guest who wants the absolute pinnacle of automotive engineering.$txt$, 1
FROM vehicles v JOIN vehicle_models vm ON vm.id=v.model_id JOIN brands b ON b.id=vm.brand_id
WHERE b.name = $txt$Bugatti$txt$ AND vm.name = $txt$Chiron Super Sport 300+$txt$
ON CONFLICT (vehicle_id, language) DO NOTHING;

INSERT INTO vehicle_editorial_reviews (vehicle_id, language, headline, body, verdict, sort_order)
SELECT v.id, 'en',
  $txt$The prancing horse, electrified — and more savage than ever$txt$,
  $txt$Ferrari's first series-production plug-in hybrid rewrites what a supercar can be. A twin-turbo V8 works with three electric motors to unleash a full 1,000 hp, launching you to 100 km/h in 2.5 seconds and on to 340 km/h. Yet the SF90 is not merely a missile: its torque-vectoring chassis and razor-sharp steering make it feel impossibly agile at any speed. Slide into the cockpit and every surface is a reminder that this is Maranello's state of the art.$txt$,
  $txt$Perfect for the guest who wants the fastest, most advanced Ferrari ever built — and the theatre of a V8 howl.$txt$, 2
FROM vehicles v JOIN vehicle_models vm ON vm.id=v.model_id JOIN brands b ON b.id=vm.brand_id
WHERE b.name = $txt$Ferrari$txt$ AND vm.name = $txt$SF90 Stradale$txt$
ON CONFLICT (vehicle_id, language) DO NOTHING;

INSERT INTO vehicle_editorial_reviews (vehicle_id, language, headline, body, verdict, sort_order)
SELECT v.id, 'en',
  $txt$The V12 rebellion continues — now with a lightning bolt$txt$,
  $txt$The Revuelto is Lamborghini's answer to the hybrid age, and it answers with a naturally aspirated 6.5-litre V12 joined by three electric motors for a combined 1,015 hp. The result is the most powerful Sant'Agata road car yet: a 350 km/h statement sculpted from carbon and raw attitude. Loud, theatrical and deliberately outrageous — exactly as a flagship Lamborghini should be. This is the car that turns a hotel forecourt into a stage.$txt$,
  $txt$Perfect for maximum drama and the sound of twelve naturally aspirated cylinders.$txt$, 3
FROM vehicles v JOIN vehicle_models vm ON vm.id=v.model_id JOIN brands b ON b.id=vm.brand_id
WHERE b.name = $txt$Lamborghini$txt$ AND vm.name = $txt$Revuelto$txt$
ON CONFLICT (vehicle_id, language) DO NOTHING;

INSERT INTO vehicle_editorial_reviews (vehicle_id, language, headline, body, verdict, sort_order)
SELECT v.id, 'en',
  $txt$The trident's return to the front line$txt$,
  $txt$The MC20 marks Maserati's rebirth as a true supercar maker. Its bespoke 'Nettuno' 3.0-litre twin-turbo V6 — a Formula 1-derived, 630 hp masterpiece — sits in a carbon monocoque, giving the car a purity and agility that shout engineering ambition. Butterfly doors open to a cabin that is driver-focused and beautifully restrained. Rare, ravishing and unmistakably Italian.$txt$,
  $txt$Perfect for guests who prize exclusivity and a supercar few others can claim.$txt$, 4
FROM vehicles v JOIN vehicle_models vm ON vm.id=v.model_id JOIN brands b ON b.id=vm.brand_id
WHERE b.name = $txt$Maserati$txt$ AND vm.name = $txt$MC20$txt$
ON CONFLICT (vehicle_id, language) DO NOTHING;

INSERT INTO vehicle_editorial_reviews (vehicle_id, language, headline, body, verdict, sort_order)
SELECT v.id, 'en',
  $txt$Ferrari's first four-door — and it was worth the wait$txt$,
  $txt$The Purosangue is not an SUV so much as a Ferrari you can share. Beneath its sculpted body sits a naturally aspirated 6.5-litre V12 producing 725 hp, mounted behind the front axle for near-perfect balance, and the result is a four-seater that drives like a thoroughbred. Rear-hinged 'welcome' doors open to a cabin of exquisite craft, and the famous V12 crescendo is present at every throttle input. The most surprising and most versatile Ferrari of the modern era.$txt$,
  $txt$Perfect for guests who want Ferrari drama with room for the whole party.$txt$, 5
FROM vehicles v JOIN vehicle_models vm ON vm.id=v.model_id JOIN brands b ON b.id=vm.brand_id
WHERE b.name = $txt$Ferrari$txt$ AND vm.name = $txt$Purosangue$txt$
ON CONFLICT (vehicle_id, language) DO NOTHING;

INSERT INTO vehicle_editorial_reviews (vehicle_id, language, headline, body, verdict, sort_order)
SELECT v.id, 'en',
  $txt$The definition of arrival — silence made magnificent$txt$,
  $txt$The Phantom is not a car you drive so much as a world you enter. Its 6.75-litre twin-turbo V12 is so hushed you measure progress in wafts, not revs, and the signature 'Magic Carpet Ride' erases the surface beneath you. Behind the coach doors lies a sanctuary of hand-finished wood, deep lambswool and the Starlight headliner — an illuminated night sky above your head. Presence, comfort and imperious calm, in equal measure.$txt$,
  $txt$Perfect for weddings, VIP transfers and any occasion where arriving is the main event.$txt$, 6
FROM vehicles v JOIN vehicle_models vm ON vm.id=v.model_id JOIN brands b ON b.id=vm.brand_id
WHERE b.name = $txt$Rolls-Royce$txt$ AND vm.name = $txt$Phantom$txt$
ON CONFLICT (vehicle_id, language) DO NOTHING;

INSERT INTO vehicle_editorial_reviews (vehicle_id, language, headline, body, verdict, sort_order)
SELECT v.id, 'en',
  $txt$The most luxurious SUV in the world — effortless, commanding, peerless$txt$,
  $txt$The Cullinan brings Rolls-Royce's fabled serenity to an SUV, and it does so without compromise. Its 6.75-litre twin-turbo V12 delivers 571 hp with the smoothness of silk, while self-levelling air suspension makes even broken roads feel freshly paved. The cabin is a suite of the finest materials, and the Viewing Suite can unfold from the tailgate at the touch of a button. Commanding, yet never aggressive.$txt$,
  $txt$Perfect for guests who refuse to choose between presence, space and absolute comfort.$txt$, 7
FROM vehicles v JOIN vehicle_models vm ON vm.id=v.model_id JOIN brands b ON b.id=vm.brand_id
WHERE b.name = $txt$Rolls-Royce$txt$ AND vm.name = $txt$Cullinan$txt$
ON CONFLICT (vehicle_id, language) DO NOTHING;

INSERT INTO vehicle_editorial_reviews (vehicle_id, language, headline, body, verdict, sort_order)
SELECT v.id, 'en',
  $txt$Grand touring perfected — a grand piano wrapped in velvet$txt$,
  $txt$The Continental GT Speed pairs a muscular 6.0-litre W12 with a chassis that hides its weight astonishingly well. All-wheel drive, rear-wheel steering and active anti-roll bars let it carve corners far better than any car this luxurious has a right to. Inside, Crewe's craftsmanship is everywhere: knurled metal, diamond-quilted leather and a rotating dashboard that turns from veneer to touchscreen at the touch of a button.$txt$,
  $txt$Perfect for long-distance elegance with a genuine turn of pace when the road opens up.$txt$, 8
FROM vehicles v JOIN vehicle_models vm ON vm.id=v.model_id JOIN brands b ON b.id=vm.brand_id
WHERE b.name = $txt$Bentley$txt$ AND vm.name = $txt$Continental GT Speed$txt$
ON CONFLICT (vehicle_id, language) DO NOTHING;

INSERT INTO vehicle_editorial_reviews (vehicle_id, language, headline, body, verdict, sort_order)
SELECT v.id, 'en',
  $txt$Four doors, twelve cylinders, one unbroken line of luxury$txt$,
  $txt$The Flying Spur is Bentley's flagship saloon, and it balances limousine comfort with genuine performance. A 6.0-litre W12 delivers 635 hp, driving all four wheels to shame far sportier cars off the line while you remain in serene refinement. The rear cabin is a first-class lounge, with diamond-quilted leather, fine veneers and the option of a rear-seat entertainment suite. It is the rare car that flatters the driver and pampers the passengers in equal measure.$txt$,
  $txt$Perfect for chauffeur-driven elegance that still knows how to sprint.$txt$, 9
FROM vehicles v JOIN vehicle_models vm ON vm.id=v.model_id JOIN brands b ON b.id=vm.brand_id
WHERE b.name = $txt$Bentley$txt$ AND vm.name = $txt$Flying Spur$txt$
ON CONFLICT (vehicle_id, language) DO NOTHING;

INSERT INTO vehicle_editorial_reviews (vehicle_id, language, headline, body, verdict, sort_order)
SELECT v.id, 'en',
  $txt$A grand tourer with a sports car's heart — and a spy's charisma$txt$,
  $txt$Aston calls the DB12 the world's first 'super tourer', and the claim holds. A 4.0-litre twin-turbo V8 delivers 680 hp with effortless authority, while a bonded aluminium structure and recalibrated suspension sharpen responses to a genuine sports-car level. The cabin is a lesson in restraint and quality, driven by its own bespoke infotainment. Beautiful, willing and quietly ferocious.$txt$,
  $txt$Perfect for guests who want understated British elegance with modern, confident performance.$txt$, 10
FROM vehicles v JOIN vehicle_models vm ON vm.id=v.model_id JOIN brands b ON b.id=vm.brand_id
WHERE b.name = $txt$Aston Martin$txt$ AND vm.name = $txt$DB12$txt$
ON CONFLICT (vehicle_id, language) DO NOTHING;

INSERT INTO vehicle_editorial_reviews (vehicle_id, language, headline, body, verdict, sort_order)
SELECT v.id, 'en',
  $txt$The everyday supercar — a naturally aspirated V10 farewell$txt$,
  $txt$The R8 is that rare thing: a mid-engined supercar you could genuinely use every day. Its 5.2-litre naturally aspirated V10 delivers 620 hp with one of the finest soundtracks in motoring, while quattro all-wheel drive turns any weather into an advantage. Build quality is impeccable and visibility is superb, so the whole car feels engineered for confidence at speed. Civilised when you want it, electrifying when you don't.$txt$,
  $txt$Perfect for exotic performance without exotic temperament.$txt$, 11
FROM vehicles v JOIN vehicle_models vm ON vm.id=v.model_id JOIN brands b ON b.id=vm.brand_id
WHERE b.name = $txt$Audi$txt$ AND vm.name = $txt$R8 V10 Performance$txt$
ON CONFLICT (vehicle_id, language) DO NOTHING;

INSERT INTO vehicle_editorial_reviews (vehicle_id, language, headline, body, verdict, sort_order)
SELECT v.id, 'en',
  $txt$The sharpest, lightest, most focused M5 ever built$txt$,
  $txt$The CS is BMW M at its most ruthless. Weight is trimmed, power rises to 635 hp, and the chassis is honed into something that feels alive beneath you. Carbon seats, gold accents and a stripped-back intensity set it apart from the standard M5, yet it keeps the four doors and everyday usability that make the formula so compelling. A limited-run super saloon — understated to look at, devastating to drive.$txt$,
  $txt$Perfect for near-supercar pace with four seats and fastidious engineering.$txt$, 12
FROM vehicles v JOIN vehicle_models vm ON vm.id=v.model_id JOIN brands b ON b.id=vm.brand_id
WHERE b.name = $txt$BMW$txt$ AND vm.name = $txt$M5 CS$txt$
ON CONFLICT (vehicle_id, language) DO NOTHING;
