-- ============================================================
-- 009 — Statut « inactive » pour les véhicules
-- ------------------------------------------------------------
-- Permet à un administrateur de retirer une voiture du
-- catalogue client SANS la supprimer.
--
-- Une voiture au statut « inactive » (comme « maintenance » et
-- « retired ») n'est pas proposée aux clients : le catalogue
-- public et la recherche de disponibilité filtrent déjà sur
-- status = 'active'.
--
-- Patch idempotent et non destructif : aucune donnée supprimée.
-- ============================================================

ALTER TYPE vehicle_status ADD VALUE IF NOT EXISTS 'inactive';
