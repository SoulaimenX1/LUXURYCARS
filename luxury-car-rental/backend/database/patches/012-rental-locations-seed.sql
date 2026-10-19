-- ============================================================
-- 012 — Lieux de prise en charge / restitution (jeu de données)
-- ------------------------------------------------------------
-- Remplit la table rental_locations avec un réseau réaliste de
-- points de service répartis sur 4 pays :
--   France, Suisse, Allemagne, Hongrie.
--
-- Catégories : showroom, airport, hotel, city_center, custom.
-- Les frais sont exprimés en euros (EUR), comme le reste de la
-- plateforme.
--
-- IDEMPOTENT ET NON DESTRUCTIF :
--   * ON CONFLICT (code) DO NOTHING ;
--   * aucune donnée supprimée ;
--   * un lieu déjà configuré par l'administrateur n'est JAMAIS
--     écrasé : le patch ne fait qu'ajouter ce qui manque.
-- ============================================================

INSERT INTO rental_locations
  (code, name, category, city, country, address,
   pickup_fee, dropoff_fee, one_way_fee,
   can_pickup, can_dropoff, enabled)
VALUES

  -- ==========================================================
  -- FRANCE
  -- ==========================================================
  ('ORY-APT', 'Aéroport Paris-Orly', 'airport', 'Orly', 'France',
   'Aéroport Paris-Orly, 94390 Orly', 90.00, 90.00, 120.00, true, true, true),

  ('LBG-APT', 'Aéroport Paris-Le Bourget', 'airport', 'Le Bourget', 'France',
   'Aéroport Paris-Le Bourget, 93350 Le Bourget', 120.00, 120.00, 160.00, true, true, true),

  ('MRS-APT', 'Aéroport Marseille-Provence', 'airport', 'Marignane', 'France',
   'Aéroport Marseille-Provence, 13700 Marignane', 100.00, 100.00, 140.00, true, true, true),

  ('LYS-APT', 'Aéroport Lyon-Saint-Exupéry', 'airport', 'Colombier-Saugnieu', 'France',
   'Aéroport Lyon-Saint-Exupéry, 69125 Colombier-Saugnieu', 90.00, 90.00, 120.00, true, true, true),

  ('BOD-APT', 'Aéroport Bordeaux-Mérignac', 'airport', 'Mérignac', 'France',
   'Aéroport Bordeaux-Mérignac, 33700 Mérignac', 90.00, 90.00, 120.00, true, true, true),

  ('TLS-APT', 'Aéroport Toulouse-Blagnac', 'airport', 'Blagnac', 'France',
   'Aéroport Toulouse-Blagnac, 31700 Blagnac', 90.00, 90.00, 120.00, true, true, true),

  ('SXB-APT', 'Aéroport Strasbourg-Entzheim', 'airport', 'Entzheim', 'France',
   'Aéroport Strasbourg-Entzheim, 67960 Entzheim', 90.00, 90.00, 120.00, true, true, true),

  ('NCE-CTR', 'Centre-ville de Nice', 'city_center', 'Nice', 'France',
   'Promenade des Anglais, 06000 Nice', 70.00, 70.00, 90.00, true, true, true),

  ('MRS-CTR', 'Centre-ville de Marseille', 'city_center', 'Marseille', 'France',
   'Vieux-Port, 13002 Marseille', 70.00, 70.00, 90.00, true, true, true),

  ('BOD-CTR', 'Centre-ville de Bordeaux', 'city_center', 'Bordeaux', 'France',
   'Place de la Bourse, 33000 Bordeaux', 70.00, 70.00, 90.00, true, true, true),

  ('TLS-CTR', 'Centre-ville de Toulouse', 'city_center', 'Toulouse', 'France',
   'Place du Capitole, 31000 Toulouse', 70.00, 70.00, 90.00, true, true, true),

  ('PAR-HOTEL', 'Le Bristol Paris', 'hotel', 'Paris', 'France',
   '112 Rue du Faubourg Saint-Honoré, 75008 Paris', 150.00, 150.00, 190.00, true, true, true),

  ('CAN-HOTEL', 'Hôtel Martinez Cannes', 'hotel', 'Cannes', 'France',
   '73 La Croisette, 06400 Cannes', 140.00, 140.00, 180.00, true, true, true),

  ('STT-HOTEL', 'Hôtel de Paris Saint-Tropez', 'hotel', 'Saint-Tropez', 'France',
   '1 Traverse de la Gendarmerie, 83990 Saint-Tropez', 160.00, 160.00, 200.00, true, true, true),

  ('CUR-HOTEL', 'Les Airelles Courchevel', 'hotel', 'Courchevel', 'France',
   'Rue du Jardin Alpin, 73120 Courchevel', 180.00, 180.00, 220.00, true, true, true),

  ('CHX-HOTEL', 'Hôtel Mont-Blanc Chamonix', 'hotel', 'Chamonix-Mont-Blanc', 'France',
   '62 Allée du Majestic, 74400 Chamonix-Mont-Blanc', 160.00, 160.00, 200.00, true, true, true),

  ('NCE-SHOWROOM', 'LuxuryCars Showroom Côte d’Azur', 'showroom', 'Nice', 'France',
   '12 Promenade des Anglais, 06000 Nice', 0.00, 0.00, 0.00, true, true, true),

  -- ==========================================================
  -- SUISSE
  -- ==========================================================
  ('GVA-APT', 'Aéroport de Genève', 'airport', 'Genève', 'Suisse',
   'Aéroport international de Genève, 1215 Genève', 110.00, 110.00, 150.00, true, true, true),

  ('ZRH-APT', 'Aéroport de Zurich', 'airport', 'Zurich', 'Suisse',
   'Aéroport de Zurich, 8058 Zurich', 120.00, 120.00, 160.00, true, true, true),

  ('BSL-APT', 'Aéroport de Bâle-Mulhouse', 'airport', 'Bâle', 'Suisse',
   'Aéroport de Bâle-Mulhouse, 4030 Bâle', 110.00, 110.00, 150.00, true, true, true),

  ('GVA-CTR', 'Centre-ville de Genève', 'city_center', 'Genève', 'Suisse',
   'Rue du Rhône, 1204 Genève', 70.00, 70.00, 90.00, true, true, true),

  ('ZRH-CTR', 'Centre-ville de Zurich', 'city_center', 'Zurich', 'Suisse',
   'Bahnhofstrasse, 8001 Zurich', 80.00, 80.00, 100.00, true, true, true),

  ('LAU-CTR', 'Centre-ville de Lausanne', 'city_center', 'Lausanne', 'Suisse',
   'Place Saint-François, 1003 Lausanne', 70.00, 70.00, 90.00, true, true, true),

  ('LUG-CTR', 'Centre-ville de Lugano', 'city_center', 'Lugano', 'Suisse',
   'Piazza della Riforma, 6900 Lugano', 80.00, 80.00, 100.00, true, true, true),

  ('GST-HOTEL', 'Gstaad Palace', 'hotel', 'Gstaad', 'Suisse',
   'Palacestrasse, 3780 Gstaad', 200.00, 200.00, 240.00, true, true, true),

  ('STM-HOTEL', 'Badrutt’s Palace Saint-Moritz', 'hotel', 'Saint-Moritz', 'Suisse',
   'Via Serlas 27, 7500 Saint-Moritz', 220.00, 220.00, 260.00, true, true, true),

  ('ZRH-SHOWROOM', 'LuxuryCars Showroom Zurich', 'showroom', 'Zurich', 'Suisse',
   'Bahnhofstrasse 21, 8001 Zurich', 0.00, 0.00, 0.00, true, true, true),

  -- ==========================================================
  -- ALLEMAGNE
  -- ==========================================================
  ('BER-APT', 'Aéroport de Berlin-Brandebourg', 'airport', 'Schönefeld', 'Allemagne',
   'Flughafen Berlin Brandenburg, 12529 Schönefeld', 100.00, 100.00, 140.00, true, true, true),

  ('MUC-APT', 'Aéroport de Munich', 'airport', 'Munich', 'Allemagne',
   'Flughafen München, 85356 München', 110.00, 110.00, 150.00, true, true, true),

  ('FRA-APT', 'Aéroport de Francfort', 'airport', 'Francfort', 'Allemagne',
   'Flughafen Frankfurt, 60547 Frankfurt am Main', 110.00, 110.00, 150.00, true, true, true),

  ('HAM-APT', 'Aéroport de Hambourg', 'airport', 'Hambourg', 'Allemagne',
   'Flughafen Hamburg, 22335 Hamburg', 100.00, 100.00, 140.00, true, true, true),

  ('DUS-APT', 'Aéroport de Düsseldorf', 'airport', 'Düsseldorf', 'Allemagne',
   'Flughafen Düsseldorf, 40474 Düsseldorf', 100.00, 100.00, 140.00, true, true, true),

  ('BER-CTR', 'Centre-ville de Berlin', 'city_center', 'Berlin', 'Allemagne',
   'Kurfürstendamm, 10707 Berlin', 70.00, 70.00, 90.00, true, true, true),

  ('MUC-CTR', 'Centre-ville de Munich', 'city_center', 'Munich', 'Allemagne',
   'Maximilianstraße, 80539 München', 70.00, 70.00, 90.00, true, true, true),

  ('FRA-CTR', 'Centre-ville de Francfort', 'city_center', 'Francfort', 'Allemagne',
   'Roßmarkt, 60311 Frankfurt am Main', 70.00, 70.00, 90.00, true, true, true),

  ('STR-CTR', 'Centre-ville de Stuttgart', 'city_center', 'Stuttgart', 'Allemagne',
   'Schlossplatz, 70173 Stuttgart', 70.00, 70.00, 90.00, true, true, true),

  ('BER-HOTEL', 'Hotel Adlon Kempinski Berlin', 'hotel', 'Berlin', 'Allemagne',
   'Unter den Linden 77, 10117 Berlin', 140.00, 140.00, 180.00, true, true, true),

  ('MUC-HOTEL', 'Hotel Bayerischer Hof', 'hotel', 'Munich', 'Allemagne',
   'Promenadeplatz 2-6, 80333 München', 150.00, 150.00, 190.00, true, true, true),

  ('MUC-SHOWROOM', 'LuxuryCars Showroom Munich', 'showroom', 'Munich', 'Allemagne',
   'Maximilianstraße 30, 80539 München', 0.00, 0.00, 0.00, true, true, true),

  -- ==========================================================
  -- HONGRIE
  -- ==========================================================
  ('BUD-APT', 'Aéroport de Budapest Liszt Ferenc', 'airport', 'Budapest', 'Hongrie',
   'Aéroport international de Budapest, 1185 Budapest', 80.00, 80.00, 110.00, true, true, true),

  ('BUD-CTR', 'Centre-ville de Budapest', 'city_center', 'Budapest', 'Hongrie',
   'Deák Ferenc tér, 1052 Budapest', 60.00, 60.00, 80.00, true, true, true),

  ('BUD-HOTEL', 'Four Seasons Gresham Palace Budapest', 'hotel', 'Budapest', 'Hongrie',
   'Széchenyi István tér 5-6, 1051 Budapest', 120.00, 120.00, 150.00, true, true, true),

  ('BUD-SHOWROOM', 'LuxuryCars Showroom Budapest', 'showroom', 'Budapest', 'Hongrie',
   'Andrássy út 12, 1061 Budapest', 0.00, 0.00, 0.00, true, true, true),

  ('BUD-GARE', 'Gare de Budapest-Keleti', 'custom', 'Budapest', 'Hongrie',
   'Baross tér, 1087 Budapest', 60.00, 60.00, 80.00, true, true, true)

ON CONFLICT (code) DO NOTHING;
