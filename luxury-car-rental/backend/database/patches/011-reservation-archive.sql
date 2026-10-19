-- ============================================================
-- 011 — Archive des réservations
-- ------------------------------------------------------------
-- Permet à l'administration d'archiver une réservation afin
-- de la retirer de la liste de travail, sans jamais la
-- supprimer : l'historique reste complet et l'opération est
-- réversible (restauration à tout moment).
--
-- L'archive est purement organisationnelle : elle ne change
-- JAMAIS le statut de la réservation et n'affecte donc pas la
-- disponibilité des véhicules ni le calendrier.
--
-- Patch idempotent et non destructif : aucune donnée supprimée.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Colonne d'archivage (NULL = réservation active).
-- ------------------------------------------------------------

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- ------------------------------------------------------------
-- 2. Index partiel : accélère la liste de travail courante
--    (réservations non archivées).
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_reservations_archived_at
  ON reservations (archived_at);

-- ------------------------------------------------------------
-- 3. Traçabilité : administrateur ayant archivé la réservation.
-- ------------------------------------------------------------

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS archived_by uuid
    REFERENCES users (id) ON DELETE SET NULL;
