
'use client';

import { useRouter } from 'next/navigation';
import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';

import styles from './availability.module.css';

import cardStyles from '@/components/vehicles/vehicle-card.module.css';
import VehicleCard from '@/components/vehicles/vehicle-card';
import type { VehicleItem } from '@/lib/catalog-types';

// ==========================================================
// TYPE DE L'ERREUR API
// ==========================================================

interface ApiError {
    message?: string | string[];
}

// ==========================================================
// TYPE DE LA PÉRIODE RECHERCHÉE
// ==========================================================

interface SearchPeriod {
    from: string;
    to: string;
}

// ==========================================================
// VÉRIFICATION DES DONNÉES VÉHICULE
// ==========================================================

function isVehicle(value: unknown): value is VehicleItem {
    if (typeof value !== 'object' || value === null) {
        return false;
    }

    return (
        'id' in value &&
        typeof value.id === 'string' &&
        'brandName' in value &&
        typeof value.brandName === 'string' &&
        'modelName' in value &&
        typeof value.modelName === 'string' &&
        'dailyPrice' in value &&
        typeof value.dailyPrice === 'string' &&
        'securityDeposit' in value &&
        typeof value.securityDeposit === 'string'
    );
}

// ==========================================================
// LIRE UNE ERREUR DU BACKEND
// ==========================================================

async function readApiError(
    response: Response,
): Promise<string> {
    try {
        const data: ApiError = await response.json();

        if (Array.isArray(data.message)) {
            return data.message.join(' ');
        }

        if (typeof data.message === 'string') {
            return data.message;
        }
    } catch {
        // Conserver le message générique si nécessaire.
    }

    return 'Unable to check vehicle availability.';
}

// ==========================================================
// FORMATEUR DE LIBELLÉ (transmission, carburant...)
// ==========================================================
//
// Transforme une valeur technique comme « plug_in_hybrid »
// en libellé lisible : « Plug In Hybrid ».

function prettyLabel(value: string): string {
    if (!value) {
        return '';
    }

    return value
        .split('_')
        .map(
            (part) =>
                part.charAt(0).toUpperCase() +
                part.slice(1),
        )
        .join(' ');
}

// ==========================================================
// PAGE AVAILABILITY
// ==========================================================

export default function AvailabilityPage() {
    const router = useRouter();

    // ========================================================
    // DATES CHOISIES PAR LE CLIENT
    // ========================================================

    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');

    // ========================================================
    // VÉHICULES DISPONIBLES
    // ========================================================

    const [vehicles, setVehicles] =
        useState<VehicleItem[] | null>(null);

    // ========================================================
    // ÉTATS DE L'INTERFACE
    // ========================================================

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // ========================================================
    // DATES DE LA DERNIÈRE RECHERCHE RÉUSSIE
    // ========================================================

    const [searchPeriod, setSearchPeriod] =
        useState<SearchPeriod | null>(null);

    // ========================================================
    // FILTRES DE LA COLLECTION DISPONIBLE
    // ========================================================
    //
    // Ces filtres s'appliquent aux voitures réellement
    // disponibles pour les dates choisies. Ils permettent au
    // client de trouver rapidement le véhicule souhaité
    // (catégorie, marque, transmission, carburant, édition).

    const [categoryFilter, setCategoryFilter] = useState('');
    const [brandFilter, setBrandFilter] = useState('');

    const [transmissionFilter, setTransmissionFilter] =
        useState('');

    const [fuelFilter, setFuelFilter] = useState('');
    const [editionOnly, setEditionOnly] = useState(false);

    // Effacer tous les filtres d'un coup.
    function clearFilters() {
        setCategoryFilter('');
        setBrandFilter('');
        setTransmissionFilter('');
        setFuelFilter('');
        setEditionOnly(false);
    }

    // ========================================================
    // MODIFICATION DES DATES
    // ========================================================

    function handleFromDateChange(value: string) {
        setFromDate(value);

        // Les anciens résultats ne correspondent plus
        // aux nouvelles dates.
        setVehicles(null);
        setSearchPeriod(null);
        setError('');
    }

    function handleToDateChange(value: string) {
        setToDate(value);

        setVehicles(null);
        setSearchPeriod(null);
        setError('');
    }

    // ========================================================
    // RECHERCHE DE DISPONIBILITÉ
    // ========================================================

    async function handleSearch(
        event: FormEvent<HTMLFormElement>,
    ) {
        event.preventDefault();

        setError('');
        setVehicles(null);
        setSearchPeriod(null);

        // Une nouvelle recherche repart de zéro : on efface les
        // filtres précédents pour montrer toutes les voitures
        // disponibles.
        clearFilters();

        // Vérifier les dates.
        if (!fromDate || !toDate) {
            setError('Please select both rental dates.');
            return;
        }

        if (toDate <= fromDate) {
            setError(
                'Return date must be after pickup date.',
            );
            return;
        }

        setLoading(true);

        try {
            // Construire les paramètres envoyés à Next.js.
            const params = new URLSearchParams({
                from: fromDate,
                to: toDate,
            });

            // Next.js communique ensuite avec NestJS.
            const response = await fetch(
                `/api/vehicles/available?${params.toString()}`,
                {
                    method: 'GET',
                    cache: 'no-store',
                },
            );

            if (!response.ok) {
                const message = await readApiError(response);
                throw new Error(message);
            }

            // Lire les voitures réellement disponibles.
            const data: unknown = await response.json();

            if (!Array.isArray(data)) {
                throw new Error('Invalid availability response.');
            }

            if (!data.every(isVehicle)) {
                throw new Error('Invalid vehicle data received.');
            }

            // Mémoriser les résultats et les dates recherchées.
            setVehicles(data);

            setSearchPeriod({
                from: fromDate,
                to: toDate,
            });
        } catch (caughtError) {
            setError(
                caughtError instanceof Error
                    ? caughtError.message
                    : 'Unable to check availability.',
            );
        } finally {
            setLoading(false);
        }
    }

    // ========================================================
    // NOUVEAU : CHOISIR UN VÉHICULE POUR LA RÉSERVATION
    // ========================================================
    //
    // Cette fonction ne crée PAS encore la réservation.
    //
    // Elle transmet les informations du véhicule sélectionné
    // vers la page de confirmation :
    //
    // /reservations/new
    //
    // Les dates proviennent obligatoirement de la dernière
    // recherche de disponibilité réussie.
    // ========================================================

    function handleReserve(vehicle: VehicleItem) {
        if (!searchPeriod) {
            setError(
                'Please check availability before reserving.',
            );
            return;
        }

        // Préparer les paramètres attendus par la page
        // frontend/src/app/reservations/new/page.tsx
        const params = new URLSearchParams({
            brandName: vehicle.brandName,
            modelName: vehicle.modelName,
            vehicleId: vehicle.id,
            pickupDate: searchPeriod.from,
            returnDate: searchPeriod.to,
        });

        // Naviguer vers le récapitulatif.
        router.push(
            `/reservations/new?${params.toString()}`,
        );
    }

    // ========================================================
    // OPTIONS DE FILTRES
    // ========================================================
    //
    // Les listes sont calculées à partir des voitures
    // réellement disponibles : aucune marque ni catégorie
    // n'est écrite en dur.

    const availableVehicles = useMemo(
        () => vehicles ?? [],
        [vehicles],
    );

    const categoryOptions = useMemo(() => {
        return Array.from(
            new Set(
                availableVehicles.map(
                    (vehicle) => vehicle.categoryName,
                ),
            ),
        ).sort();
    }, [availableVehicles]);

    const brandOptions = useMemo(() => {
        return Array.from(
            new Set(
                availableVehicles.map(
                    (vehicle) => vehicle.brandName,
                ),
            ),
        ).sort();
    }, [availableVehicles]);

    const transmissionOptions = useMemo(() => {
        return Array.from(
            new Set(
                availableVehicles.map(
                    (vehicle) => vehicle.transmission,
                ),
            ),
        ).sort();
    }, [availableVehicles]);

    const fuelOptions = useMemo(() => {
        return Array.from(
            new Set(
                availableVehicles.map(
                    (vehicle) => vehicle.fuelType,
                ),
            ),
        ).sort();
    }, [availableVehicles]);

    // ========================================================
    // VÉHICULES DISPONIBLES FILTRÉS
    // ========================================================

    const filteredVehicles = useMemo(() => {
        return availableVehicles.filter((vehicle) => {
            if (
                categoryFilter &&
                vehicle.categoryName !== categoryFilter
            ) {
                return false;
            }

            if (
                brandFilter &&
                vehicle.brandName !== brandFilter
            ) {
                return false;
            }

            if (
                transmissionFilter &&
                vehicle.transmission !== transmissionFilter
            ) {
                return false;
            }

            if (
                fuelFilter &&
                vehicle.fuelType !== fuelFilter
            ) {
                return false;
            }

            if (editionOnly && !vehicle.isLimited) {
                return false;
            }

            return true;
        });
    }, [
        availableVehicles,
        categoryFilter,
        brandFilter,
        transmissionFilter,
        fuelFilter,
        editionOnly,
    ]);

    const hasActiveFilters =
        Boolean(categoryFilter) ||
        Boolean(brandFilter) ||
        Boolean(transmissionFilter) ||
        Boolean(fuelFilter) ||
        editionOnly;

    // ========================================================
    // INTERFACE PRINCIPALE
    // ========================================================

    return (
        <main className={styles.page}>

            {/* ================================================= */}
            {/* HERO                                             */}
            {/* ================================================= */}

            <section className={styles.hero}>
                <div className={styles.container}>

                    <span className={styles.eyebrow}>
                        PLAN YOUR EXPERIENCE
                    </span>

                    <h1>
                        Find your
                        <span> perfect drive.</span>
                    </h1>

                    <p className={styles.heroDescription}>
                        Select your rental dates and discover the luxury
                        vehicles available for your journey.
                    </p>

                </div>
            </section>

            {/* ================================================= */}
            {/* FORMULAIRE DES DATES                             */}
            {/* ================================================= */}

            <section className={styles.searchSection}>
                <div className={styles.container}>

                    <form
                        className={styles.searchForm}
                        onSubmit={handleSearch}
                    >

                        <div className={styles.formHeading}>
                            <span className={styles.eyebrow}>
                                VEHICLE AVAILABILITY
                            </span>

                            <h2>Choose your dates</h2>

                            <p>
                                Enter your preferred pickup and return dates.
                            </p>
                        </div>

                        <div className={styles.formGrid}>

                            {/* DATE DE DÉPART */}

                            <div className={styles.field}>
                                <label htmlFor="fromDate">
                                    Pickup date
                                </label>

                                <input
                                    id="fromDate"
                                    name="fromDate"
                                    type="date"
                                    required
                                    value={fromDate}
                                    onChange={(event) =>
                                        handleFromDateChange(event.target.value)
                                    }
                                />
                            </div>

                            {/* DATE DE RETOUR */}

                            <div className={styles.field}>
                                <label htmlFor="toDate">
                                    Return date
                                </label>

                                <input
                                    id="toDate"
                                    name="toDate"
                                    type="date"
                                    required
                                    min={fromDate || undefined}
                                    value={toDate}
                                    onChange={(event) =>
                                        handleToDateChange(event.target.value)
                                    }
                                />
                            </div>

                            {/* BOUTON DE RECHERCHE */}

                            <button
                                type="submit"
                                className={styles.searchButton}
                                disabled={loading}
                            >
                                {loading
                                    ? 'Searching...'
                                    : 'Check availability'}
                            </button>

                        </div>

                        {error && (
                            <div className={styles.error} role="alert">
                                {error}
                            </div>
                        )}

                    </form>

                </div>
            </section>

            {/* ================================================= */}
            {/* RÉSULTATS                                        */}
            {/* ================================================= */}

            <section className={styles.resultsSection}>
                <div className={styles.container}>

                    {/* AVANT LA PREMIÈRE RECHERCHE */}

                    {!loading && vehicles === null && !error && (
                        <div className={styles.emptyState}>

                            <div className={styles.emptyIcon}>
                                01
                            </div>

                            <h2>Your journey starts here</h2>

                            <p>
                                Select your rental dates above to explore
                                our available luxury vehicles.
                            </p>

                        </div>
                    )}

                    {/* CHARGEMENT */}

                    {loading && (
                        <div
                            className={styles.emptyState}
                            aria-live="polite"
                        >
                            <h2>Checking availability...</h2>

                            <p>
                                Searching the fleet for your selected dates.
                            </p>
                        </div>
                    )}

                    {/* AUCUN VÉHICULE DISPONIBLE */}

                    {!loading && vehicles?.length === 0 && (
                        <div className={styles.emptyState}>
                            <h2>No vehicles available</h2>

                            <p>
                                There are no available vehicles for
                                your selected dates. Please try another period.
                            </p>
                        </div>
                    )}

                    {/* ============================================= */}
                    {/* VÉHICULES DISPONIBLES                        */}
                    {/* ============================================= */}

                    {!loading &&
                        vehicles !== null &&
                        vehicles.length > 0 &&
                        searchPeriod && (
                            <>

                                {/* EN-TÊTE DES RÉSULTATS */}

                                <div className={styles.resultsHeader}>

                                    <div>
                                        <span className={styles.eyebrow}>
                                            AVAILABLE COLLECTION
                                        </span>

                                        <h2>
                                            Available vehicles
                                        </h2>

                                        <p>
                                            {searchPeriod.from}
                                            {' → '}
                                            {searchPeriod.to}

                                            {hasActiveFilters && (
                                                <>
                                                    {' · '}
                                                    {filteredVehicles.length}
                                                    {' of '}
                                                    {vehicles.length}
                                                    {' shown'}
                                                </>
                                            )}
                                        </p>
                                    </div>

                                    <div className={styles.resultCount}>
                                        <strong>
                                            {filteredVehicles.length}
                                        </strong>

                                        <span>
                                            {filteredVehicles.length === 1
                                                ? 'Vehicle available'
                                                : 'Vehicles available'}
                                        </span>
                                    </div>

                                </div>

                                {/* ============================================= */}
                                {/* FILTRES DE LA COLLECTION DISPONIBLE          */}
                                {/* ============================================= */}

                                <div className={styles.filters}>

                                    <div className={styles.filterGroup}>
                                        <span className={styles.filterLabel}>
                                            Category
                                        </span>

                                        <div className={styles.pills}>
                                            <button
                                                type="button"
                                                className={
                                                    categoryFilter === ''
                                                        ? styles.pillActive
                                                        : styles.pill
                                                }
                                                onClick={() =>
                                                    setCategoryFilter('')
                                                }
                                            >
                                                All
                                            </button>

                                            {categoryOptions.map((category) => (
                                                <button
                                                    key={category}
                                                    type="button"
                                                    className={
                                                        categoryFilter === category
                                                            ? styles.pillActive
                                                            : styles.pill
                                                    }
                                                    onClick={() =>
                                                        setCategoryFilter(category)
                                                    }
                                                >
                                                    {category}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className={styles.filterControls}>

                                        {/* MARQUE */}

                                        <label className={styles.selectField}>
                                            <span className={styles.filterLabel}>
                                                Brand
                                            </span>

                                            <select
                                                value={brandFilter}
                                                onChange={(event) =>
                                                    setBrandFilter(event.target.value)
                                                }
                                            >
                                                <option value="">
                                                    All brands
                                                </option>

                                                {brandOptions.map((brand) => (
                                                    <option
                                                        key={brand}
                                                        value={brand}
                                                    >
                                                        {brand}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>

                                        {/* TRANSMISSION */}

                                        <label className={styles.selectField}>
                                            <span className={styles.filterLabel}>
                                                Transmission
                                            </span>

                                            <select
                                                value={transmissionFilter}
                                                onChange={(event) =>
                                                    setTransmissionFilter(
                                                        event.target.value,
                                                    )
                                                }
                                            >
                                                <option value="">All</option>

                                                {transmissionOptions.map(
                                                    (option) => (
                                                        <option
                                                            key={option}
                                                            value={option}
                                                        >
                                                            {prettyLabel(option)}
                                                        </option>
                                                    ),
                                                )}
                                            </select>
                                        </label>

                                        {/* CARBURANT */}

                                        <label className={styles.selectField}>
                                            <span className={styles.filterLabel}>
                                                Fuel
                                            </span>

                                            <select
                                                value={fuelFilter}
                                                onChange={(event) =>
                                                    setFuelFilter(event.target.value)
                                                }
                                            >
                                                <option value="">All</option>

                                                {fuelOptions.map((option) => (
                                                    <option
                                                        key={option}
                                                        value={option}
                                                    >
                                                        {prettyLabel(option)}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>

                                        {/* ÉDITIONS LIMITÉES */}

                                        <button
                                            type="button"
                                            aria-pressed={editionOnly}
                                            className={
                                                editionOnly
                                                    ? styles.editionToggleActive
                                                    : styles.editionToggle
                                            }
                                            onClick={() =>
                                                setEditionOnly(
                                                    (previous) => !previous,
                                                )
                                            }
                                        >
                                            Limited editions only
                                        </button>

                                        {/* EFFACER */}

                                        {hasActiveFilters && (
                                            <button
                                                type="button"
                                                className={styles.clearButton}
                                                onClick={clearFilters}
                                            >
                                                Clear filters
                                            </button>
                                        )}

                                    </div>

                                </div>

                                {/* AUCUN RÉSULTAT POUR CES FILTRES */}

                                {filteredVehicles.length === 0 && (
                                    <div className={styles.emptyState}>
                                        <h2>
                                            No vehicles match your filters
                                        </h2>

                                        <p>
                                            Try another category, brand or
                                            specification, or reset the filters.
                                        </p>

                                        <button
                                            type="button"
                                            className={styles.clearButton}
                                            onClick={clearFilters}
                                        >
                                            Clear filters
                                        </button>
                                    </div>
                                )}

                                {/* CARTES DES VÉHICULES */}

                                {filteredVehicles.length > 0 && (
                                    <div className={cardStyles.vehicleGrid}>

                                        {filteredVehicles.map((vehicle, index) => (
                                            <VehicleCard
                                                key={vehicle.id}
                                                vehicle={vehicle}
                                                index={index}
                                                availableLabel="Available for selected dates"
                                                cta={{
                                                    label: 'Reserve this vehicle →',
                                                    onClick: () => handleReserve(vehicle),
                                                }}
                                            />
                                        ))}

                                    </div>
                                )}

                            </>
                        )}

                </div>
            </section>

        </main>
    );
}
