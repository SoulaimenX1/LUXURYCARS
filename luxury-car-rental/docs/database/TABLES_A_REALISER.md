# Tables de base de données à réaliser — LUXURY CARS

Liste complète et **ordonnée** (ordre de création respectant les clés étrangères)
de toutes les tables du projet, avec leur domaine fonctionnel et leur rôle.

> SGBD : **PostgreSQL 15+** · Devise par défaut : **EUR**
> Source de vérité : `backend/database/schema.sql`
> Script prêt à exécuter : `docs/database/create_all_tables.sql`

---

## Ordre de création (dépendances FK)

| Ordre | Table | Domaine | Dépend de |
| :---: | --- | --- | --- |
| 1 | `users` | Auth & utilisateurs | — |
| 2 | `refresh_tokens` | Auth & utilisateurs | `users` |
| 3 | `one_time_tokens` | Auth & utilisateurs | `users` |
| 4 | `customer_profiles` | Auth & utilisateurs | `users` |
| 5 | `brands` | Catalogue | — |
| 6 | `categories` | Catalogue | — |
| 7 | `vehicle_models` | Catalogue | `brands`, `categories` |
| 8 | `vehicles` | Catalogue | `vehicle_models` |
| 9 | `vehicle_images` | Catalogue | `vehicles` |
| 10 | `vehicle_unavailability` | Catalogue | `vehicles`, `users` |
| 11 | `notifications` | Catalogue | `vehicles` |
| 12 | `reservations` | Réservations | `customer_profiles`, `vehicles`, `users` |
| 13 | `rentals` | Location & retour | `reservations`, `users` |
| 14 | `inspections` | Location & retour | `rentals`, `users` |
| 15 | `inspection_damages` | Location & retour | `inspections` |
| 16 | `security_deposits` | Argent | `rentals` |
| 17 | `payments` | Argent | `rentals`, `users` |
| 18 | `additional_charges` | Argent | `rentals`, `inspection_damages`, `users` |
| 19 | `invoices` | Argent | `rentals`, `users` |
| 20 | `invoice_items` | Argent | `invoices`, `additional_charges` |
| 21 | `documents` | Documents | `rentals`, `invoices`, `users` |
| 22 | `audit_logs` | Audit | `users` |

**Total : 22 tables.**

---

## 1. Authentification & utilisateurs

### `users` — comptes (client / staff / admin)
| Colonne | Type | Contraintes |
| --- | --- | --- |
| id | uuid | PK, défaut `gen_random_uuid()` |
| email | citext | NOT NULL, UNIQUE |
| password_hash | text | NULL si statut `invited` |
| role | user_role | NOT NULL, défaut `customer` |
| status | account_status | NOT NULL, défaut `active` |
| first_name | varchar(100) | NOT NULL |
| last_name | varchar(100) | NOT NULL |
| phone | varchar(30) | |
| email_verified_at | timestamptz | |
| last_login_at | timestamptz | |
| created_at | timestamptz | NOT NULL, défaut `now()` |
| updated_at | timestamptz | NOT NULL, défaut `now()` |

Check : `status = 'invited' OR password_hash IS NOT NULL`.

### `refresh_tokens` — sessions persistantes
| Colonne | Type | Contraintes |
| --- | --- | --- |
| id | uuid | PK |
| user_id | uuid | NOT NULL → `users(id)` ON DELETE CASCADE |
| token_hash | text | NOT NULL, UNIQUE |
| expires_at | timestamptz | NOT NULL |
| revoked_at | timestamptz | |
| ip_address | inet | |
| user_agent | text | |
| created_at | timestamptz | NOT NULL, défaut `now()` |

Index : `idx_refresh_tokens_user (user_id)`.

### `one_time_tokens` — reset mot de passe / vérification e-mail
| Colonne | Type | Contraintes |
| --- | --- | --- |
| id | uuid | PK |
| user_id | uuid | NOT NULL → `users(id)` CASCADE |
| type | token_type | NOT NULL |
| token_hash | text | NOT NULL, UNIQUE |
| expires_at | timestamptz | NOT NULL |
| used_at | timestamptz | |
| created_at | timestamptz | NOT NULL, défaut `now()` |

Index : `idx_one_time_tokens_user (user_id)`.

### `customer_profiles` — données client (1-1 avec users)
| Colonne | Type | Contraintes |
| --- | --- | --- |
| user_id | uuid | PK → `users(id)` CASCADE |
| date_of_birth | date | NOT NULL |
| address_line | varchar(255) | |
| city | varchar(100) | |
| postal_code | varchar(20) | |
| country | char(2) | |
| license_number | varchar(50) | NOT NULL |
| license_country | char(2) | NOT NULL |
| license_issued_on | date | NOT NULL |
| license_expires_on | date | NOT NULL |

Check : `license_expires_on > license_issued_on`. Unique : `(license_country, license_number)`.

---

## 2. Catalogue de véhicules

### `brands` — marques
`id` uuid PK · `name` varchar(80) NOT NULL UNIQUE.

### `categories` — catégories (Sedan, SUV, Coupe…)
`id` uuid PK · `name` varchar(80) NOT NULL UNIQUE · `description` text.

### `vehicle_models` — modèles
`id` uuid PK · `brand_id` uuid NOT NULL → `brands` · `category_id` uuid NOT NULL → `categories` · `name` varchar(100) NOT NULL.
Unique : `(brand_id, name)`. Index : `idx_vehicle_models_category`.

### `vehicles` — véhicules
| Colonne | Type | Contraintes |
| --- | --- | --- |
| id | uuid | PK |
| model_id | uuid | NOT NULL → `vehicle_models` |
| manufacture_year | smallint | NOT NULL, 1990–2100 |
| license_plate | varchar(20) | NOT NULL, UNIQUE |
| vin | char(17) | NOT NULL, UNIQUE |
| color | varchar(40) | |
| transmission | transmission_type | NOT NULL |
| fuel_type | fuel_type | NOT NULL |
| seats | smallint | NOT NULL, défaut 2, 1–9 |
| power_hp | smallint | > 0 |
| daily_price | numeric(10,2) | NOT NULL, > 0 |
| security_deposit | numeric(10,2) | NOT NULL, ≥ 0 |
| mileage_km | integer | NOT NULL, défaut 0, ≥ 0 |
| description | text | |
| engine | varchar(120) | |
| torque_nm | integer | > 0 |
| acceleration_0_100 | numeric(4,1) | > 0 |
| top_speed_kmh | smallint | > 0 |
| consumption_l_100km | numeric(4,1) | > 0 |
| is_special | boolean | NOT NULL, défaut false |
| is_limited | boolean | NOT NULL, défaut false |
| edition_size | integer | > 0 |
| announced_at | timestamptz | NOT NULL, défaut `now()` |
| status | vehicle_status | NOT NULL, défaut `active` |
| created_at / updated_at | timestamptz | NOT NULL, défaut `now()` |

Index : `idx_vehicles_model`, `idx_vehicles_status`.

### `vehicle_images` — photos des véhicules
| Colonne | Type | Contraintes |
| --- | --- | --- |
| id | uuid | PK |
| vehicle_id | uuid | NOT NULL → `vehicles` CASCADE |
| storage_path | text | NOT NULL |
| alt_text | varchar(255) | |
| is_primary | boolean | NOT NULL, défaut false |
| sort_order | smallint | NOT NULL, défaut 0 |
| created_at | timestamptz | NOT NULL, défaut `now()` |

Index : `idx_vehicle_images_vehicle`. Unique partiel : une seule image primaire par véhicule (`uq_vehicle_primary_image`).

### `vehicle_unavailability` — indisponibilités planifiées
| Colonne | Type | Contraintes |
| --- | --- | --- |
| id | uuid | PK |
| vehicle_id | uuid | NOT NULL → `vehicles` CASCADE |
| starts_at / ends_at | timestamptz | NOT NULL |
| period | tstzrange | GENERATED (`[starts_at, ends_at)`) |
| reason | unavailability_reason | NOT NULL |
| notes | text | |
| created_by | uuid | NOT NULL → `users` |
| created_at | timestamptz | NOT NULL, défaut `now()` |

Check : `ends_at > starts_at`. Exclusion GiST : pas de chevauchement par véhicule.

### `notifications` — annonces (nouveau véhicule / éditions)
| Colonne | Type | Contraintes |
| --- | --- | --- |
| id | uuid | PK |
| type | notification_type | NOT NULL, défaut `general` |
| title | varchar(160) | NOT NULL |
| message | text | |
| vehicle_id | uuid | → `vehicles` CASCADE |
| is_published | boolean | NOT NULL, défaut true |
| created_at | timestamptz | NOT NULL, défaut `now()` |

Index : `idx_notifications_created (created_at DESC)`, `idx_notifications_vehicle`.

---

## 3. Réservations

### `reservations`
| Colonne | Type | Contraintes |
| --- | --- | --- |
| id | uuid | PK |
| reservation_number | varchar(20) | NOT NULL, UNIQUE, défaut `RES-YYYY-NNNNNN` |
| customer_id | uuid | NOT NULL → `customer_profiles(user_id)` |
| vehicle_id | uuid | NOT NULL → `vehicles` |
| pickup_at / return_at | timestamptz | NOT NULL |
| period | tstzrange | GENERATED (`[pickup_at, return_at)`) |
| rental_days | integer | NOT NULL, > 0 |
| daily_price | numeric(10,2) | NOT NULL, > 0 (snapshot) |
| deposit_amount | numeric(10,2) | NOT NULL, ≥ 0 |
| total_amount | numeric(12,2) | NOT NULL, ≥ 0, = `rental_days * daily_price` |
| status | reservation_status | NOT NULL, défaut `pending` |
| customer_notes | text | |
| decided_by | uuid | → `users` SET NULL |
| decided_at | timestamptz | |
| decision_reason | text | |
| created_at / updated_at | timestamptz | NOT NULL, défaut `now()` |

Check : `return_at > pickup_at`, `total_amount = rental_days * daily_price`.
**Exclusion GiST** : anti double-booking (statuts pending/confirmed/converted).

---

## 4. Location & retour

### `rentals` — contrats de location
| Colonne | Type | Contraintes |
| --- | --- | --- |
| id | uuid | PK |
| contract_number | varchar(20) | NOT NULL, UNIQUE, défaut `CTR-YYYY-NNNNNN` |
| reservation_id | uuid | NOT NULL, UNIQUE → `reservations` (1 résa → 1 location) |
| status | rental_status | NOT NULL, défaut `active` |
| started_at | timestamptz | NOT NULL, défaut `now()` |
| expected_return_at | timestamptz | NOT NULL |
| returned_at / closed_at | timestamptz | |
| opened_by | uuid | NOT NULL → `users` |
| closed_by | uuid | → `users` |
| notes | text | |
| created_at / updated_at | timestamptz | NOT NULL, défaut `now()` |

Check : cohérence du cycle de vie (`active` → `returned` → `closed`).

### `inspections` — état des lieux (départ/retour)
| Colonne | Type | Contraintes |
| --- | --- | --- |
| id | uuid | PK |
| rental_id | uuid | NOT NULL → `rentals` CASCADE |
| type | inspection_type | NOT NULL |
| performed_at | timestamptz | NOT NULL, défaut `now()` |
| performed_by | uuid | NOT NULL → `users` |
| mileage_km | integer | NOT NULL, ≥ 0 |
| fuel_level_pct | smallint | NOT NULL, 0–100 |
| overall_condition | condition_rating | NOT NULL |
| notes | text | |

Unique : `(rental_id, type)`.

### `inspection_damages` — dommages constatés
| Colonne | Type | Contraintes |
| --- | --- | --- |
| id | uuid | PK |
| inspection_id | uuid | NOT NULL → `inspections` CASCADE |
| vehicle_zone | varchar(60) | NOT NULL |
| description | text | NOT NULL |
| severity | damage_severity | NOT NULL |
| estimated_repair_cost | numeric(10,2) | ≥ 0 |
| photo_path | text | |

Index : `idx_damages_inspection`.

---

## 5. Argent (cautions, paiements, frais, factures)

### `security_deposits` — cautions
| Colonne | Type | Contraintes |
| --- | --- | --- |
| id | uuid | PK |
| rental_id | uuid | NOT NULL, UNIQUE → `rentals` CASCADE |
| amount | numeric(10,2) | NOT NULL, ≥ 0 |
| status | deposit_status | NOT NULL, défaut `pending` |
| retained_amount | numeric(10,2) | NOT NULL, défaut 0, ≥ 0, ≤ amount |
| retention_reason | text | requis si `retained_amount > 0` |
| held_at / released_at | timestamptz | |
| created_at / updated_at | timestamptz | NOT NULL, défaut `now()` |

### `payments` — registre des paiements (append-only)
| Colonne | Type | Contraintes |
| --- | --- | --- |
| id | uuid | PK |
| rental_id | uuid | NOT NULL → `rentals` RESTRICT |
| type | payment_type | NOT NULL |
| method | payment_method | NOT NULL |
| amount | numeric(12,2) | NOT NULL, > 0 |
| currency | char(3) | NOT NULL, défaut `EUR` |
| paid_at | timestamptz | NOT NULL, défaut `now()` |
| reference | varchar(100) | |
| recorded_by | uuid | NOT NULL → `users` |
| notes | text | |
| created_at | timestamptz | NOT NULL, défaut `now()` |

Index : `idx_payments_rental`, `idx_payments_paid_at`.

### `additional_charges` — frais supplémentaires
| Colonne | Type | Contraintes |
| --- | --- | --- |
| id | uuid | PK |
| rental_id | uuid | NOT NULL → `rentals` CASCADE |
| type | charge_type | NOT NULL |
| description | varchar(255) | NOT NULL |
| amount | numeric(10,2) | NOT NULL, > 0 |
| inspection_damage_id | uuid | → `inspection_damages` SET NULL |
| created_by | uuid | NOT NULL → `users` |
| created_at | timestamptz | NOT NULL, défaut `now()` |

Index : `idx_charges_rental`.

### `invoices` — factures
| Colonne | Type | Contraintes |
| --- | --- | --- |
| id | uuid | PK |
| invoice_number | varchar(20) | UNIQUE, attribué à l'émission |
| rental_id | uuid | NOT NULL → `rentals` RESTRICT |
| status | invoice_status | NOT NULL, défaut `draft` |
| currency | char(3) | NOT NULL, défaut `EUR` |
| subtotal | numeric(12,2) | NOT NULL, ≥ 0 |
| tax_rate | numeric(5,2) | NOT NULL, défaut 0, 0–100 |
| tax_amount | numeric(12,2) | NOT NULL, ≥ 0 |
| total_amount | numeric(12,2) | NOT NULL, = subtotal + tax_amount |
| issued_at | timestamptz | |
| issued_by | uuid | → `users` SET NULL |
| created_at / updated_at | timestamptz | NOT NULL, défaut `now()` |

Index : `idx_invoices_rental`.

### `invoice_items` — lignes de facture
| Colonne | Type | Contraintes |
| --- | --- | --- |
| id | uuid | PK |
| invoice_id | uuid | NOT NULL → `invoices` CASCADE |
| description | varchar(255) | NOT NULL |
| quantity | numeric(10,2) | NOT NULL, > 0 |
| unit_price | numeric(10,2) | NOT NULL, ≥ 0 |
| line_total | numeric(12,2) | GENERATED (`round(quantity*unit_price,2)`) |
| additional_charge_id | uuid | → `additional_charges` SET NULL |

Index : `idx_invoice_items_invoice`.

---

## 6. Documents & audit

### `documents` — métadonnées des PDF (contrats, factures…)
| Colonne | Type | Contraintes |
| --- | --- | --- |
| id | uuid | PK |
| rental_id | uuid | NOT NULL → `rentals` CASCADE |
| invoice_id | uuid | → `invoices` SET NULL |
| type | document_type | NOT NULL |
| file_name | varchar(255) | NOT NULL |
| storage_path | text | NOT NULL, UNIQUE |
| mime_type | varchar(100) | NOT NULL, défaut `application/pdf` |
| size_bytes | integer | NOT NULL, > 0 |
| sha256 | char(64) | NOT NULL |
| generated_by | uuid | NOT NULL → `users` |
| created_at | timestamptz | NOT NULL, défaut `now()` |

Index : `idx_documents_rental`.

### `audit_logs` — journal d'audit
| Colonne | Type | Contraintes |
| --- | --- | --- |
| id | bigint | PK, IDENTITY |
| actor_id | uuid | → `users` SET NULL |
| action | varchar(50) | NOT NULL |
| entity_type | varchar(50) | NOT NULL |
| entity_id | uuid | |
| old_values / new_values | jsonb | |
| ip_address | inet | |
| created_at | timestamptz | NOT NULL, défaut `now()` |

Index : `idx_audit_entity`, `idx_audit_actor`.

---

## Objets complémentaires à réaliser

| Objet | Type | Rôle |
| --- | --- | --- |
| `find_available_vehicles(p_from, p_to)` | fonction SQL | véhicules disponibles sur une période |
| `v_dashboard_summary` | vue | compteurs du tableau de bord admin |
| `v_monthly_revenue` | vue | chiffre d'affaires mensuel (cautions exclues) |
| `set_updated_at()` | fonction trigger | maintient `updated_at` |
| `trg_reservation_vs_unavailability()` | trigger | réservation vs indisponibilité |
| `trg_unavailability_vs_reservation()` | trigger | indisponibilité vs réservation |
| `trg_inspection_mileage()` | trigger | km retour ≥ km départ |
| `reservation_number_seq` | séquence | numéro `RES-…` |
| `contract_number_seq` | séquence | numéro `CTR-…` |
| `invoice_number_seq` | séquence | numéro de facture |

---

## Récapitulatif

| Déjà utilisé par l'app ✅ | À développer 🟡 |
| --- | --- |
| `users`, `customer_profiles`, `brands`, `categories`, `vehicle_models`, `vehicles`, `vehicle_images`, `notifications`, `reservations` (9) | `refresh_tokens`, `one_time_tokens`, `vehicle_unavailability`, `rentals`, `inspections`, `inspection_damages`, `security_deposits`, `payments`, `additional_charges`, `invoices`, `invoice_items`, `documents`, `audit_logs` (13) |
