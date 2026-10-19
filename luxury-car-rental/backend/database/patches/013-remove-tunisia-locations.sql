-- ============================================================
-- 013 — Retrait des lieux de prise en charge / restitution
--        situés en Tunisie
-- ------------------------------------------------------------
-- Demande explicite : ne conserver que
--   France, Suisse, Allemagne, Hongrie.
--
-- Suppression CIBLÉE des 13 lieux ajoutés par le patch 012
-- (aucune autre ligne n'est touchée).
--
-- Historique préservé : la clé étrangère de reservation_preferences
-- est ON DELETE SET NULL et le libellé choisi lors de la réservation
-- reste figé dans pickup_location_snapshot / dropoff_location_snapshot.
-- Aucune réservation référençant ces lieux n'existe à ce jour.
--
-- Le bloc Tunisie a également été retiré du patch 012 afin qu'un
-- re-run de celui-ci ne réintroduise pas ces lieux.
-- ============================================================

DELETE FROM rental_locations
WHERE code IN (
  'TUN-APT',      -- Aéroport de Tunis-Carthage
  'TUN-CTR',      -- Centre-ville de Tunis
  'CAR-CTR',      -- Carthage
  'MAR-CTR',      -- La Marsa
  'SOU-CTR',      -- Centre-ville de Sousse
  'GAM-HOTEL',    -- Four Seasons Hotel Tunis
  'HAM-HOTEL',    -- Hôtel Le Sultan Hammamet
  'DJE-APT',      -- Aéroport de Djerba-Zarzis
  'MIR-APT',      -- Aéroport de Monastir Habib Bourguiba
  'SFA-APT',      -- Aéroport de Sfax-Thyna
  'TOE-APT',      -- Aéroport de Tozeur-Nefta
  'TUN-SHOWROOM', -- LuxuryCars Showroom Tunis
  'TUN-GARE'      -- Gare de Tunis Ville
);
