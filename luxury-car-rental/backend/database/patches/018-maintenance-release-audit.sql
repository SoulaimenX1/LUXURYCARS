-- ============================================================
-- 018 — HISTORIQUE DE MAINTENANCE
--       (LIBÉRATION NON DESTRUCTIVE DES BLOCS D'INDISPONIBILITÉ)
-- ============================================================
-- F-05 : conserver la trace complète des blocs
-- (maintenance / réparation / inspection) après leur libération.
--
-- CONTEXTE
-- --------
-- Retirer un bloc de `vehicle_unavailability` est nécessaire pour
-- que le véhicule redevienne planifiable : la contrainte EXCLUDE
--   ex_unavail_no_overlap EXCLUDE (vehicle_id WITH =, period WITH &&)
-- s'applique à TOUTES les lignes d'une table PostgreSQL (PostgreSQL
-- 15 accepte un prédicat WHERE sur les contraintes UNIQUE/UNIQUE
-- index, mais une contrainte EXCLUDE partielle garde la sémantique
-- de la contrainte et reste délicate à faire évoluer ; c'est
-- pourquoi l'approche « journal d'audit séparé » est préférée : elle
-- ne touche NI la table active, NI la contrainte EXCLUDE, NI le
-- trigger de protection des réservations).
--
-- PRINCIPE
-- --------
-- Avant de supprimer la ligne active, l'API recopie intégralement son
-- contenu dans cette table d'audit, dans LA MÊME transaction :
--   1. SELECT ... FOR UPDATE  (verrou de ligne)
--   2. INSERT INTO vehicle_unavailability_audit
--   3. DELETE FROM vehicle_unavailability
-- Si l'insertion échoue, la transaction est annulée (rollback) et le
-- bloc actif reste en place.
--
-- Table strictement ADDITIVE :
--   * aucune donnée existante n'est modifiée ou supprimée ;
--   * aucune contrainte/règle métier existante n'est retirée ;
--   * les blocs libérés AVANT cette migration ne sont pas reconstitués
--     (on n'invente aucune donnée).
--
-- Les colonnes d'identité historiques (véhicule, créateur, administrateur
-- libérateur) sont conservées en UUID bruts, volontairement SANS clé
-- étrangère : l'audit doit rester immuable et ne doit jamais être effacé
-- ni anonymisé par une suppression en cascade ou un ON DELETE SET NULL.
-- ============================================================

SET client_encoding TO 'UTF8';

BEGIN;

CREATE TABLE IF NOT EXISTS vehicle_unavailability_audit (
    id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identifiant d'origine du bloc dans vehicle_unavailability.
    unavailability_id uuid        NOT NULL,

    -- Véhicule concerné et période initialement bloquée.
    vehicle_id        uuid        NOT NULL,
    starts_at         timestamp with time zone NOT NULL,
    ends_at           timestamp with time zone NOT NULL,
    reason            unavailability_reason NOT NULL,
    notes             text,

    -- Créateur d'origine et date de création du bloc.
    created_by        uuid,
    created_at        timestamp with time zone,

    -- Trace de la libération.
    released_at       timestamp with time zone NOT NULL DEFAULT now(),
    released_by       uuid,
    release_reason    text
);

-- Une seule trace de libération par bloc : garantit qu'une libération
-- répétée ne peut jamais créer d'historique en double.
CREATE UNIQUE INDEX IF NOT EXISTS uq_unavail_audit_unavailability
    ON vehicle_unavailability_audit (unavailability_id);

-- Consultation du calendrier historique par véhicule/période.
CREATE INDEX IF NOT EXISTS idx_unavail_audit_vehicle
    ON vehicle_unavailability_audit (vehicle_id, starts_at);

-- Consultation chronologique des libérations.
CREATE INDEX IF NOT EXISTS idx_unavail_audit_released_at
    ON vehicle_unavailability_audit (released_at DESC);

COMMENT ON TABLE vehicle_unavailability_audit IS
    'F-05 — journal immuable des blocs d''indisponibilité libérés (trace de maintenance).';

COMMIT;
