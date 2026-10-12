
'use client';

import { useEffect, useMemo, useState } from 'react';

import styles from './vehicles.module.css';

import cardStyles from '@/components/vehicles/vehicle-card.module.css';
import VehicleCard from '@/components/vehicles/vehicle-card';
import type { VehicleItem } from '@/lib/catalog-types';

// ==========================================================
// VÉRIFIER LA STRUCTURE DES VÉHICULES
// ==========================================================

function isVehicle(value: unknown): value is VehicleItem {
    if (typeof value !== 'object' || value === null) {
        return false;
    }

    // Vérifier quelques propriétés essentielles
    // pour éviter d'afficher une réponse incorrecte.
    return (
        'id' in value &&
        typeof value.id === 'string' &&
        'brandName' in value &&
        typeof value.brandName === 'string' &&
        'modelName' in value &&
        typeof value.modelName === 'string' &&
        'dailyPrice' in value &&
        typeof value.dailyPrice === 'string'
    );
}

// ==========================================================
// PAGE DU CATALOGUE
// ==========================================================

export default function VehiclesPage() {
    // Liste reçue depuis PostgreSQL via NestJS.
    const [vehicles, setVehicles] = useState<VehicleItem[]>([]);

    // États de chargement et d'erreur.
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Permet de relancer un chargement après une erreur.
    const [retryCount, setRetryCount] = useState(0);

    // ========================================================
    // FILTRES DU CATALOGUE
    // ========================================================
    //
    // Les filtres peuvent être pré-remplis par l'URL : les
    // liens « Choose your driving style » de l'accueil ouvrent
    // directement la bonne catégorie.

    const [categoryFilter, setCategoryFilter] = useState('');
    const [brandFilter, setBrandFilter] = useState('');
    const [editionOnly, setEditionOnly] = useState(false);
    const [hydrated, setHydrated] = useState(false);

    // Lire les filtres présents dans l'URL au premier rendu.
    //
    // L'initialisation est volontairement faite après
    // l'hydratation : l'URL n'existe pas côté serveur, donc
    // initialiser l'état pendant le rendu provoquerait une
    // incohérence d'hydratation.
    useEffect(() => {
        /* eslint-disable react-hooks/set-state-in-effect --
           synchronisation volontaire avec l'URL après montage. */
        const params = new URLSearchParams(
            window.location.search,
        );

        const category = params.get('category');
        const brand = params.get('brand');
        const edition = params.get('edition');

        if (category) {
            setCategoryFilter(category);
        }

        if (brand) {
            setBrandFilter(brand);
        }

        if (edition === 'limited') {
            setEditionOnly(true);
        }

        setHydrated(true);
        /* eslint-enable react-hooks/set-state-in-effect */
    }, []);

    // Refléter les filtres actifs dans l'URL (liens
    // partageables) sans provoquer de navigation.
    useEffect(() => {
        if (!hydrated) {
            return;
        }

        const params = new URLSearchParams();

        if (categoryFilter) {
            params.set('category', categoryFilter);
        }

        if (brandFilter) {
            params.set('brand', brandFilter);
        }

        if (editionOnly) {
            params.set('edition', 'limited');
        }

        const query = params.toString();

        window.history.replaceState(
            null,
            '',
            `${window.location.pathname}${query ? `?${query}` : ''}`,
        );
    }, [hydrated, categoryFilter, brandFilter, editionOnly]);

    // ========================================================
    // RÉCUPÉRER LES VÉHICULES
    // ========================================================

    useEffect(() => {
        const controller = new AbortController();

        async function loadVehicles() {
            setLoading(true);
            setError('');

            try {
                // Appeler notre route Next.js.
                const response = await fetch('/api/vehicles/catalog', {
                    method: 'GET',
                    cache: 'no-store',
                    signal: controller.signal,
                });

                if (!response.ok) {
                    throw new Error('Unable to load vehicle catalogue.');
                }

                const data: unknown = await response.json();

                // Le backend doit retourner un tableau.
                if (!Array.isArray(data)) {
                    throw new Error('Invalid catalogue response.');
                }

                // Vérifier chaque véhicule.
                const validVehicles = data.filter(isVehicle);

                if (validVehicles.length !== data.length) {
                    throw new Error('Invalid vehicle data received.');
                }

                if (!controller.signal.aborted) {
                    setVehicles(validVehicles);
                }
            } catch {
                if (!controller.signal.aborted) {
                    setError(
                        'Unable to load vehicles. Please try again.',
                    );
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        }

        void loadVehicles();

        // Annuler la requête si la page est quittée.
        return () => {
            controller.abort();
        };
    }, [retryCount]);

    // ========================================================
    // RÉCUPÉRER LES MARQUES DISPONIBLES
    // ========================================================
    //
    // Les options proviennent des données réelles,
    // sans liste de marques écrite manuellement.
    // ========================================================

    const brands = useMemo(() => {
        return Array.from(
            new Set(vehicles.map((vehicle) => vehicle.brandName)),
        ).sort();
    }, [vehicles]);

    // ========================================================
    // RÉCUPÉRER LES CATÉGORIES DISPONIBLES
    // ========================================================

    const categories = useMemo(() => {
        return Array.from(
            new Set(vehicles.map((vehicle) => vehicle.categoryName)),
        ).sort();
    }, [vehicles]);

    // ========================================================
    // SÉLECTION RECOMMANDÉE
    // ========================================================
    //
    // Le catalogue affiche la collection "recommandée",
    // les véhicules les plus exclusifs en premier, puis les
    // filtres (catégorie, marque, édition limitée) restreignent
    // l'affichage. Les filtres peuvent être pré-remplis par
    // l'URL depuis la page d'accueil.
    // ========================================================

    const recommendedVehicles = useMemo(() => {
        return [...vehicles]
            .sort(
                (a, b) =>
                    Number(b.dailyPrice) -
                    Number(a.dailyPrice),
            );
    }, [vehicles]);

    // ========================================================
    // VÉHICULES FILTRÉS
    // ========================================================

    const filteredVehicles = useMemo(() => {
        return recommendedVehicles.filter((vehicle) => {
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

            if (editionOnly && !vehicle.isLimited) {
                return false;
            }

            return true;
        });
    }, [
        recommendedVehicles,
        categoryFilter,
        brandFilter,
        editionOnly,
    ]);

    const hasActiveFilters =
        Boolean(categoryFilter) ||
        Boolean(brandFilter) ||
        editionOnly;

    function clearFilters() {
        setCategoryFilter('');
        setBrandFilter('');
        setEditionOnly(false);
    }

    // ========================================================
    // INTERFACE DU CATALOGUE
    // ========================================================

    return (
        <main className={styles.page}>

            {/* ================================================= */}
            {/* INTRODUCTION                                     */}
            {/* ================================================= */}

            <section className={styles.hero}>
                <div className={styles.container}>

                    <span className={styles.eyebrow}>
                        RECOMMENDED COLLECTION
                    </span>

                    <h1>
                        Discover our
                        <span> recommended fleet.</span>
                    </h1>

                    <p>
                        A hand-curated selection of the
                        most exclusive vehicles.
                    </p>

                    <div className={styles.heroDivider} />

                    <div className={styles.heroStats}>
                        <div>
                            <strong>{vehicles.length}</strong>
                            <span>Vehicles in catalogue</span>
                        </div>

                        <div>
                            <strong>{brands.length}</strong>
                            <span>Luxury brands</span>
                        </div>

                        <div>
                            <strong>{categories.length}</strong>
                            <span>Vehicle categories</span>
                        </div>
                    </div>

                </div>
            </section>

            {/* ================================================= */}
            {/* CATALOGUE                                        */}
            {/* ================================================= */}

            <section className={styles.catalogue}>
                <div className={styles.container}>

                    <div className={styles.sectionHeading}>
                        <div>
                            <span className={styles.eyebrow}>
                                RECOMMENDED FOR YOU
                            </span>

                            <h2>The fleet, curated</h2>
                        </div>

                        <p>
                            {filteredVehicles.length}
                            {' '}
                            {filteredVehicles.length === 1
                                ? 'vehicle'
                                : 'vehicles'}
                            {' '}
                            {hasActiveFilters
                                ? 'found'
                                : 'selected'}
                        </p>
                    </div>

                    {/* ============================================= */}
                    {/* FILTRES                                      */}
                    {/* ============================================= */}

                    {!loading && !error && vehicles.length > 0 && (
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

                                    {categories.map((category) => (
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
                                <label className={styles.selectField}>
                                    <span className={styles.filterLabel}>
                                        Brand
                                    </span>

                                    <select
                                        value={brandFilter}
                                        onChange={(event) =>
                                            setBrandFilter(
                                                event.target.value,
                                            )
                                        }
                                    >
                                        <option value="">
                                            All brands
                                        </option>

                                        {brands.map((brand) => (
                                            <option
                                                key={brand}
                                                value={brand}
                                            >
                                                {brand}
                                            </option>
                                        ))}
                                    </select>
                                </label>

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
                    )}

                    {/* ============================================= */}
                    {/* CHARGEMENT                                   */}
                    {/* ============================================= */}

                    {loading && (
                        <div className={styles.messageBox}>
                            <p>Loading luxury vehicles...</p>
                        </div>
                    )}

                    {/* ============================================= */}
                    {/* ERREUR                                       */}
                    {/* ============================================= */}

                    {!loading && error && (
                        <div className={styles.messageBox} role="alert">
                            <h3>Catalogue unavailable</h3>

                            <p>{error}</p>

                            <button
                                type="button"
                                className={styles.retryButton}
                                onClick={() =>
                                    setRetryCount((previous) => previous + 1)
                                }
                            >
                                Try again
                            </button>
                        </div>
                    )}

                    {/* ============================================= */}
                    {/* CATALOGUE VIDE                               */}
                    {/* ============================================= */}

                    {!loading &&
                        !error &&
                        vehicles.length === 0 && (
                            <div className={styles.messageBox}>
                                <h3>The collection is being curated</h3>

                                <p>
                                    New luxury vehicles will appear here soon.
                                </p>
                            </div>
                        )}

                    {/* ============================================= */}
                    {/* AUCUN RÉSULTAT POUR CES FILTRES               */}
                    {/* ============================================= */}

                    {!loading &&
                        !error &&
                        vehicles.length > 0 &&
                        filteredVehicles.length === 0 && (
                            <div className={styles.messageBox}>
                                <h3>No vehicles match your filters</h3>

                                <p>
                                    Try another category or brand, or
                                    reset the filters.
                                </p>

                                <button
                                    type="button"
                                    className={styles.retryButton}
                                    onClick={clearFilters}
                                >
                                    Clear filters
                                </button>
                            </div>
                        )}

                    {/* ============================================= */}
                    {/* CARTES DES VÉHICULES                          */}
                    {/* ============================================= */}

                    {!loading &&
                        !error &&
                        filteredVehicles.length > 0 && (
                            <div className={cardStyles.vehicleGrid}>
                                {filteredVehicles.map((vehicle, index) => (
                                    <VehicleCard
                                        key={vehicle.id}
                                        vehicle={vehicle}
                                        index={index}
                                        cta={{
                                            label: 'Reserve this vehicle →',
                                            href: '/availability',
                                        }}
                                    />
                                ))}
                            </div>
                        )}

                </div>
            </section>

        </main>
    );
}
