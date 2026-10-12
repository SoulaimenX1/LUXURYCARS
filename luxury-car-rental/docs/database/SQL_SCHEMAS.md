# Schémas SQL — LUXURY CARS

Document de référence des schémas de base de données du projet.

- **Source de vérité du schéma complet** : `backend/database/schema.sql`
- **Patch incrémental** : `backend/database/patches/002-editions-and-notifications.sql`
- **Migrations TypeORM** : `backend/src/database/migrations/`

Légende :

| Symbole | Signification |
| --- | --- |
| ✅ **DÉJÀ FAIT** | Table créée en base **et** utilisée par l'application (entité TypeORM ou requête applicative). |
| 🟡 **À FAIRE** | Table créée en base (schema.sql appliqué) mais **non encore exploitée** par l'application (feature prévue mais non développée). |

> État réel observé en base : les **22 tables** du schéma complet existent déjà,
> mais seule une partie est branchée dans le code.

---

## 1. Schéma de NOTRE niveau de projet (déjà fait) ✅

Périmètre réellement implémenté aujourd'hui : catalogue de voitures, comptes clients,
réservations et notifications.

```mermaid
erDiagram
    USERS {
        uuid id PK
        citext email UK
        varchar password_hash
        user_role role
        account_status status
        varchar first_name
        varchar last_name
        varchar phone
        timestamptz email_verified_at
        timestamptz last_login_at
        timestamptz created_at
        timestamptz updated_at
    }

    CUSTOMER_PROFILES {
        uuid user_id PK
        date date_of_birth
        varchar address_line
        varchar city
        varchar postal_code
        char country
        varchar license_number
        char license_country
        date license_issued_on
        date license_expires_on
    }

    BRANDS {
        uuid id PK
        varchar name UK
    }

    CATEGORIES {
        uuid id PK
        varchar name UK
        text description
    }

    VEHICLE_MODELS {
        uuid id PK
        uuid brand_id FK
        uuid category_id FK
        varchar name
    }

    VEHICLES {
        uuid id PK
        uuid model_id FK
        smallint manufacture_year
        varchar license_plate UK
        char vin UK
        varchar color
        transmission_type transmission
        fuel_type fuel_type
        smallint seats
        smallint power_hp
        numeric daily_price
        numeric security_deposit
        integer mileage_km
        text description
        varchar engine
        integer torque_nm
        numeric acceleration_0_100
        smallint top_speed_kmh
        numeric consumption_l_100km
        boolean is_special
        boolean is_limited
        integer edition_size
        timestamptz announced_at
        vehicle_status status
        timestamptz created_at
        timestamptz updated_at
    }

    VEHICLE_IMAGES {
        uuid id PK
        uuid vehicle_id FK
        text storage_path
        media_type media_type
        text poster_path
        varchar alt_text
        boolean is_primary
        smallint sort_order
        timestamptz created_at
    }

    NOTIFICATIONS {
        uuid id PK
        notification_type type
        varchar title
        text message
        uuid vehicle_id FK
        boolean is_published
        timestamptz created_at
    }

    RESERVATIONS {
        uuid id PK
        varchar reservation_number UK
        uuid customer_id FK
        uuid vehicle_id FK
        timestamptz pickup_at
        timestamptz return_at
        tstzrange period
        integer rental_days
        numeric daily_price
        numeric deposit_amount
        numeric total_amount
        reservation_status status
        text customer_notes
        uuid decided_by FK
        timestamptz decided_at
        text decision_reason
        timestamptz created_at
        timestamptz updated_at
    }

    USERS ||--o| CUSTOMER_PROFILES : "profil client 1-1"
    USERS ||--o{ RESERVATIONS : "effectue (decided_by)"
    CUSTOMER_PROFILES ||--o{ RESERVATIONS : "reserve"
    BRANDS ||--o{ VEHICLE_MODELS : "possede"
    CATEGORIES ||--o{ VEHICLE_MODELS : "classe"
    VEHICLE_MODELS ||--o{ VEHICLES : "decline"
    VEHICLES ||--o{ VEHICLE_IMAGES : "photos"
    VEHICLES ||--o{ NOTIFICATIONS : "concerne"
    VEHICLES ||--o{ RESERVATIONS : "est reservee"
```

**Tables de ce périmètre (✅ déjà fait)**

| Table | Entité / usage applicatif |
| --- | --- |
| `users` | `user.entity.ts` — auth, rôles |
| `customer_profiles` | `customer-profile.entity.ts` |
| `brands` | `brand.entity.ts` |
| `categories` | `category.entity.ts` |
| `vehicle_models` | `vehicle-model.entity.ts` |
| `vehicles` | `vehicle.entity.ts` |
| `vehicle_images` | gérée par les scripts (`vehicle-images.mjs`) — table vidée (stockage manuel) |
| `notifications` | `notification.entity.ts` |
| `reservations` | `reservation.entity.ts` |

---

## 2. Schéma COMPLET du projet — vue d'ensemble

Le schéma complet décrit un **système de gestion de location de voitures de luxe**
(paiements enregistrés par le personnel, tarification journalière, rôles
customer / staff / admin, devise EUR par défaut).

### 2.1 Déjà fait ✅ vs À faire 🟡

```mermaid
erDiagram
    USERS {
        uuid id PK
        citext email UK
    }
    CUSTOMER_PROFILES {
        uuid user_id PK
    }
    BRANDS {
        uuid id PK
    }
    CATEGORIES {
        uuid id PK
    }
    VEHICLE_MODELS {
        uuid id PK
    }
    VEHICLES {
        uuid id PK
    }
    VEHICLE_IMAGES {
        uuid id PK
    }
    NOTIFICATIONS {
        uuid id PK
    }
    RESERVATIONS {
        uuid id PK
    }

    REFRESH_TOKENS {
        uuid id PK
    }
    ONE_TIME_TOKENS {
        uuid id PK
    }
    VEHICLE_UNAVAILABILITY {
        uuid id PK
    }
    RENTALS {
        uuid id PK
    }
    INSPECTIONS {
        uuid id PK
    }
    INSPECTION_DAMAGES {
        uuid id PK
    }
    SECURITY_DEPOSITS {
        uuid id PK
    }
    PAYMENTS {
        uuid id PK
    }
    ADDITIONAL_CHARGES {
        uuid id PK
    }
    INVOICES {
        uuid id PK
    }
    INVOICE_ITEMS {
        uuid id PK
    }
    DOCUMENTS {
        uuid id PK
    }
    AUDIT_LOGS {
        bigint id PK
    }

    USERS ||--o| CUSTOMER_PROFILES : "1-1"
    USERS ||--o{ REFRESH_TOKENS : "sessions"
    USERS ||--o{ ONE_TIME_TOKENS : "reset / verify"
    BRANDS ||--o{ VEHICLE_MODELS : "possede"
    CATEGORIES ||--o{ VEHICLE_MODELS : "classe"
    VEHICLE_MODELS ||--o{ VEHICLES : "decline"
    VEHICLES ||--o{ VEHICLE_IMAGES : "photos"
    VEHICLES ||--o{ NOTIFICATIONS : "concerne"
    VEHICLES ||--o{ VEHICLE_UNAVAILABILITY : "indisponible"
    CUSTOMER_PROFILES ||--o{ RESERVATIONS : "reserve"
    VEHICLES ||--o{ RESERVATIONS : "est reservee"
    RESERVATIONS ||--o| RENTALS : "convertit en"
    RENTALS ||--o{ INSPECTIONS : "controle"
    INSPECTIONS ||--o{ INSPECTION_DAMAGES : "constate"
    RENTALS ||--o| SECURITY_DEPOSITS : "caution"
    RENTALS ||--o{ PAYMENTS : "paiements"
    RENTALS ||--o{ ADDITIONAL_CHARGES : "frais"
    INSPECTION_DAMAGES ||--o{ ADDITIONAL_CHARGES : "facture"
    RENTALS ||--o{ INVOICES : "facture"
    INVOICES ||--o{ INVOICE_ITEMS : "lignes"
    ADDITIONAL_CHARGES ||--o{ INVOICE_ITEMS : "refacture"
    RENTALS ||--o{ DOCUMENTS : "documents"
    INVOICES ||--o{ DOCUMENTS : "pieces"
    USERS ||--o{ AUDIT_LOGS : "trace"
```

### 2.2 Détail par domaine

#### A. Authentification & utilisateurs

```mermaid
erDiagram
    USERS {
        uuid id PK
        citext email UK
        text password_hash
        user_role role
        account_status status
        varchar first_name
        varchar last_name
        varchar phone
        timestamptz email_verified_at
        timestamptz last_login_at
        timestamptz created_at
        timestamptz updated_at
    }

    CUSTOMER_PROFILES {
        uuid user_id PK
        date date_of_birth
        varchar address_line
        varchar city
        varchar postal_code
        char country
        varchar license_number
        char license_country
        date license_issued_on
        date license_expires_on
    }

    REFRESH_TOKENS {
        uuid id PK
        uuid user_id FK
        text token_hash UK
        timestamptz expires_at
        timestamptz revoked_at
        inet ip_address
        text user_agent
        timestamptz created_at
    }

    ONE_TIME_TOKENS {
        uuid id PK
        uuid user_id FK
        token_type type
        text token_hash UK
        timestamptz expires_at
        timestamptz used_at
        timestamptz created_at
    }

    USERS ||--o| CUSTOMER_PROFILES : "profil 1-1"
    USERS ||--o{ REFRESH_TOKENS : "sessions"
    USERS ||--o{ ONE_TIME_TOKENS : "reset / verify"
```

#### B. Catalogue de véhicules

```mermaid
erDiagram
    BRANDS {
        uuid id PK
        varchar name UK
    }
    CATEGORIES {
        uuid id PK
        varchar name UK
        text description
    }
    VEHICLE_MODELS {
        uuid id PK
        uuid brand_id FK
        uuid category_id FK
        varchar name
    }
    VEHICLES {
        uuid id PK
        uuid model_id FK
        smallint manufacture_year
        varchar license_plate UK
        char vin UK
        varchar color
        transmission_type transmission
        fuel_type fuel_type
        smallint seats
        smallint power_hp
        numeric daily_price
        numeric security_deposit
        integer mileage_km
        text description
        varchar engine
        integer torque_nm
        numeric acceleration_0_100
        smallint top_speed_kmh
        numeric consumption_l_100km
        boolean is_special
        boolean is_limited
        integer edition_size
        timestamptz announced_at
        vehicle_status status
        timestamptz created_at
        timestamptz updated_at
    }
    VEHICLE_IMAGES {
        uuid id PK
        uuid vehicle_id FK
        text storage_path
        media_type media_type
        text poster_path
        varchar alt_text
        boolean is_primary
        smallint sort_order
        timestamptz created_at
    }
    VEHICLE_UNAVAILABILITY {
        uuid id PK
        uuid vehicle_id FK
        timestamptz starts_at
        timestamptz ends_at
        tstzrange period
        unavailability_reason reason
        text notes
        uuid created_by FK
        timestamptz created_at
    }
    NOTIFICATIONS {
        uuid id PK
        notification_type type
        varchar title
        text message
        uuid vehicle_id FK
        boolean is_published
        timestamptz created_at
    }

    BRANDS ||--o{ VEHICLE_MODELS : "possede"
    CATEGORIES ||--o{ VEHICLE_MODELS : "classe"
    VEHICLE_MODELS ||--o{ VEHICLES : "decline"
    VEHICLES ||--o{ VEHICLE_IMAGES : "photos"
    VEHICLES ||--o{ VEHICLE_UNAVAILABILITY : "indisponible"
    VEHICLES ||--o{ NOTIFICATIONS : "concerne"
```

#### C. Réservations

```mermaid
erDiagram
    CUSTOMER_PROFILES {
        uuid user_id PK
    }
    VEHICLES {
        uuid id PK
    }
    USERS {
        uuid id PK
    }
    RESERVATIONS {
        uuid id PK
        varchar reservation_number UK
        uuid customer_id FK
        uuid vehicle_id FK
        timestamptz pickup_at
        timestamptz return_at
        tstzrange period
        integer rental_days
        numeric daily_price
        numeric deposit_amount
        numeric total_amount
        reservation_status status
        text customer_notes
        uuid decided_by FK
        timestamptz decided_at
        text decision_reason
        timestamptz created_at
        timestamptz updated_at
    }

    CUSTOMER_PROFILES ||--o{ RESERVATIONS : "reserve"
    VEHICLES ||--o{ RESERVATIONS : "est reservee"
    USERS ||--o{ RESERVATIONS : "decide (decided_by)"
```

> Contraintes clés : `EXCLUDE USING gist` interdit le **double booking**
> (chevauchement de période pour une même voiture, statuts pending/confirmed/converted).

#### D. Locations, contrôles et retour

```mermaid
erDiagram
    RESERVATIONS {
        uuid id PK
    }
    USERS {
        uuid id PK
    }
    RENTALS {
        uuid id PK
        varchar contract_number UK
        uuid reservation_id FK
        rental_status status
        timestamptz started_at
        timestamptz expected_return_at
        timestamptz returned_at
        timestamptz closed_at
        uuid opened_by FK
        uuid closed_by FK
        text notes
        timestamptz created_at
        timestamptz updated_at
    }
    INSPECTIONS {
        uuid id PK
        uuid rental_id FK
        inspection_type type
        timestamptz performed_at
        uuid performed_by FK
        integer mileage_km
        smallint fuel_level_pct
        condition_rating overall_condition
        text notes
    }
    INSPECTION_DAMAGES {
        uuid id PK
        uuid inspection_id FK
        varchar vehicle_zone
        text description
        damage_severity severity
        numeric estimated_repair_cost
        text photo_path
    }

    RESERVATIONS ||--o| RENTALS : "convertit en"
    USERS ||--o{ RENTALS : "ouvre / ferme"
    RENTALS ||--o{ INSPECTIONS : "controle"
    USERS ||--o{ INSPECTIONS : "effectue"
    INSPECTIONS ||--o{ INSPECTION_DAMAGES : "constate"
```

#### E. Argent : cautions, paiements, frais, factures

```mermaid
erDiagram
    RENTALS {
        uuid id PK
    }
    USERS {
        uuid id PK
    }
    SECURITY_DEPOSITS {
        uuid id PK
        uuid rental_id FK
        numeric amount
        deposit_status status
        numeric retained_amount
        text retention_reason
        timestamptz held_at
        timestamptz released_at
        timestamptz created_at
        timestamptz updated_at
    }
    PAYMENTS {
        uuid id PK
        uuid rental_id FK
        payment_type type
        payment_method method
        numeric amount
        char currency
        timestamptz paid_at
        varchar reference
        uuid recorded_by FK
        text notes
        timestamptz created_at
    }
    ADDITIONAL_CHARGES {
        uuid id PK
        uuid rental_id FK
        charge_type type
        varchar description
        numeric amount
        uuid inspection_damage_id FK
        uuid created_by FK
        timestamptz created_at
    }
    INVOICES {
        uuid id PK
        varchar invoice_number UK
        uuid rental_id FK
        invoice_status status
        char currency
        numeric subtotal
        numeric tax_rate
        numeric tax_amount
        numeric total_amount
        timestamptz issued_at
        uuid issued_by FK
        timestamptz created_at
        timestamptz updated_at
    }
    INVOICE_ITEMS {
        uuid id PK
        uuid invoice_id FK
        varchar description
        numeric quantity
        numeric unit_price
        numeric line_total
        uuid additional_charge_id FK
    }
    INSPECTION_DAMAGES {
        uuid id PK
    }

    RENTALS ||--o| SECURITY_DEPOSITS : "caution"
    RENTALS ||--o{ PAYMENTS : "paiements"
    RENTALS ||--o{ ADDITIONAL_CHARGES : "frais"
    INSPECTION_DAMAGES ||--o{ ADDITIONAL_CHARGES : "facture"
    RENTALS ||--o{ INVOICES : "facture"
    USERS ||--o{ PAYMENTS : "enregistre"
    USERS ||--o{ INVOICES : "emet"
    INVOICES ||--o{ INVOICE_ITEMS : "lignes"
    ADDITIONAL_CHARGES ||--o{ INVOICE_ITEMS : "refacture"
```

#### F. Documents & journal d'audit

```mermaid
erDiagram
    RENTALS {
        uuid id PK
    }
    INVOICES {
        uuid id PK
    }
    USERS {
        uuid id PK
    }
    DOCUMENTS {
        uuid id PK
        uuid rental_id FK
        uuid invoice_id FK
        document_type type
        varchar file_name
        text storage_path UK
        varchar mime_type
        integer size_bytes
        char sha256
        uuid generated_by FK
        timestamptz created_at
    }
    AUDIT_LOGS {
        bigint id PK
        uuid actor_id FK
        varchar action
        varchar entity_type
        uuid entity_id
        jsonb old_values
        jsonb new_values
        inet ip_address
        timestamptz created_at
    }

    RENTALS ||--o{ DOCUMENTS : "documents"
    INVOICES ||--o{ DOCUMENTS : "pieces"
    USERS ||--o{ DOCUMENTS : "genere"
    USERS ||--o{ AUDIT_LOGS : "trace"
```

---

## 3. Énumérations PostgreSQL

| Enum | Valeurs |
| --- | --- |
| `user_role` | customer, staff, admin |
| `account_status` | invited, active, suspended |
| `token_type` | password_reset, email_verification |
| `transmission_type` | automatic, manual, semi_automatic |
| `fuel_type` | petrol, diesel, hybrid, plug_in_hybrid, electric |
| `vehicle_status` | active, maintenance, retired |
| `media_type` | image, video |
| `unavailability_reason` | maintenance, repair, inspection, other |
| `reservation_status` | pending, confirmed, rejected, cancelled, expired, converted |
| `rental_status` | active, returned, closed |
| `inspection_type` | handover, return |
| `condition_rating` | excellent, good, fair, damaged |
| `damage_severity` | minor, moderate, major |
| `payment_type` | rental_payment, deposit_payment, deposit_refund, charge_payment, refund |
| `payment_method` | cash, card, bank_transfer |
| `deposit_status` | pending, held, released, partially_retained, retained |
| `charge_type` | late_return, fuel, mileage, damage, cleaning, other |
| `invoice_status` | draft, issued, paid, void |
| `document_type` | contract, invoice, inspection_report, other |
| `notification_type` | new_vehicle, special_edition, limited_edition, general |

---

## 4. Vues & fonctions

| Objet | Type | Rôle |
| --- | --- | --- |
| `find_available_vehicles(p_from, p_to)` | fonction SQL | véhicules réservables sur une période |
| `v_dashboard_summary` | vue | compteurs admin (véhicules, réservations, locations, clients) |
| `v_monthly_revenue` | vue | chiffre d'affaires mensuel (cautions exclues) |
| `set_updated_at()` | trigger function | met à jour `updated_at` |
| `trg_reservation_vs_unavailability()` | trigger | bloque réservation vs indisponibilité |
| `trg_unavailability_vs_reservation()` | trigger | bloque indisponibilité vs réservation |
| `trg_inspection_mileage()` | trigger | cohérence kilométrage retour ≥ départ |

---

## 5. Récapitulatif DÉJÀ FAIT / À FAIRE

| # | Table | Domaine | État |
| --- | --- | --- | --- |
| 1 | `users` | Auth | ✅ Déjà fait |
| 2 | `customer_profiles` | Auth | ✅ Déjà fait |
| 3 | `refresh_tokens` | Auth | 🟡 À faire |
| 4 | `one_time_tokens` | Auth | 🟡 À faire |
| 5 | `brands` | Catalogue | ✅ Déjà fait |
| 6 | `categories` | Catalogue | ✅ Déjà fait |
| 7 | `vehicle_models` | Catalogue | ✅ Déjà fait |
| 8 | `vehicles` | Catalogue | ✅ Déjà fait |
| 9 | `vehicle_images` | Catalogue | ✅ Déjà fait (stockage manuel) |
| 10 | `vehicle_unavailability` | Catalogue | 🟡 À faire |
| 11 | `notifications` | Catalogue | ✅ Déjà fait |
| 12 | `reservations` | Réservations | ✅ Déjà fait |
| 13 | `rentals` | Location | 🟡 À faire |
| 14 | `inspections` | Location | 🟡 À faire |
| 15 | `inspection_damages` | Location | 🟡 À faire |
| 16 | `security_deposits` | Argent | 🟡 À faire |
| 17 | `payments` | Argent | 🟡 À faire |
| 18 | `additional_charges` | Argent | 🟡 À faire |
| 19 | `invoices` | Argent | 🟡 À faire |
| 20 | `invoice_items` | Argent | 🟡 À faire |
| 21 | `documents` | Documents | 🟡 À faire |
| 22 | `audit_logs` | Audit | 🟡 À faire |

> **Note** : les 22 tables sont **déjà créées** en base (le `schema.sql` complet est
> appliqué par la migration `InitialSchema`). « À faire » signifie donc
> *fonctionnalité applicative non développée*, pas *table absente*.
