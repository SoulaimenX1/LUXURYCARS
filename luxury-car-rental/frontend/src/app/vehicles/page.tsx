
'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Price } from '@/components/currency-provider';

import styles from './vehicles.module.css';
import { useToast } from '@/components/toast';

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
// COMPARAISON — MEILLEURE VALEUR PAR CARACTÉRISTIQUE
// ==========================================================
//
// Chaque ligne comparable reçoit une direction :
//   - « low »  : la valeur la plus basse est la meilleure
//     (tarif journalier, caution — le moins cher gagne) ;
//   - « high » : la valeur la plus haute est la meilleure
//     (puissance, valeur du véhicule, places).
//
// Les caractéristiques sans « meilleur » objectif (boîte de
// vitesses, carburant) ne sont pas mises en évidence. La
// comparaison fonctionne pour 2 ou 3 voitures : seule la
// meilleure valeur de la ligne est stylée.

type CompareDirection = 'high' | 'low';

interface CompareRow {
    label: string;
    cell: (vehicle: VehicleItem) => ReactNode;
    value?: (vehicle: VehicleItem) => number | null;
    better?: CompareDirection;
}

function toNumber(value: string | number | null | undefined): number | null {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    const amount = Number(value);

    return Number.isFinite(amount) ? amount : null;
}

const compareRows: CompareRow[] = [
    {
        label: 'Daily rate',
        cell: (vehicle) => <Price value={vehicle.dailyPrice} />,
        value: (vehicle) => toNumber(vehicle.dailyPrice),
        better: 'low',
    },
    {
        label: 'Deposit',
        cell: (vehicle) => <Price value={vehicle.securityDeposit} />,
        value: (vehicle) => toNumber(vehicle.securityDeposit),
        better: 'low',
    },
    {
        label: 'Value',
        cell: (vehicle) => <Price value={vehicle.vehicleValue} />,
        value: (vehicle) => toNumber(vehicle.vehicleValue),
        better: 'high',
    },
    {
        label: 'Seats',
        cell: (vehicle) => vehicle.seats,
        value: (vehicle) => toNumber(vehicle.seats),
        better: 'high',
    },
    {
        label: 'Power',
        cell: (vehicle) => `${vehicle.powerHp} HP`,
        value: (vehicle) => toNumber(vehicle.powerHp),
        better: 'high',
    },
    {
        label: 'Transmission',
        cell: (vehicle) => vehicle.transmission,
    },
    {
        label: 'Fuel',
        cell: (vehicle) => vehicle.fuelType,
    },
];

// Index de la meilleure valeur de la ligne.
// Renvoie -1 si aucune valeur ne se démarque : moins de deux
// valeurs comparables, ou valeurs identiques.
function bestCompareIndex(
    values: (number | null)[],
    direction: CompareDirection,
): number {
    const numeric = values.filter((value): value is number => value !== null);

    if (numeric.length < 2 || numeric.every((value) => value === numeric[0])) {
        return -1;
    }

    const best =
        direction === 'high' ? Math.max(...numeric) : Math.min(...numeric);

    return values.findIndex((value) => value === best);
}

// ==========================================================
// PAGE DU CATALOGUE
// ==========================================================

export default function VehiclesPage() {
    const toast = useToast();

    // Liste reçue depuis PostgreSQL via NestJS.
    const [vehicles, setVehicles] = useState<VehicleItem[]>([]);

    // États de chargement et d'erreur.
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [comparedIds,setComparedIds] = useState<string[]>([]);
    const [favoriteIds,setFavoriteIds] = useState<string[]>([]);
    // Vrai uniquement si un client est connecté : le bouton
    // « Save » est réservé aux comptes clients.
    const [isCustomer,setIsCustomer] = useState(false);
    const [premiumError,setPremiumError] = useState('');

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

    // Déterminer si le visiteur est un client connecté.
    // Les visiteurs sans compte ne voient aucun bouton « Save ».
    useEffect(()=>{
      const controller=new AbortController();
      void fetch('/api/auth/session',{signal:controller.signal,cache:'no-store'})
        .then(r=>r.ok?r.json():{user:null})
        .then((data:{user?:{role?:string}|null})=>{if(!controller.signal.aborted) setIsCustomer(data.user?.role==='customer');})
        .catch(()=>{});
      return ()=>controller.abort();
    },[]);

    // Les favoris sont conservés par compte côté PostgreSQL.
    // La liste n'est chargée que pour un client connecté.
    useEffect(()=>{
      if(!isCustomer) return;
      const controller=new AbortController();
      void fetch('/api/premium/me/favorites',{signal:controller.signal,cache:'no-store'})
        .then(r=>r.ok?r.json():[])
        .then((items:{vehicleId:string}[])=>{if(!controller.signal.aborted) setFavoriteIds(items.map(i=>i.vehicleId));})
        .catch(()=>{});
      return ()=>controller.abort();
    },[isCustomer]);

    // Anti double-clic : un seul appel réseau par véhicule à la fois,
    // pour éviter des enregistrements/suppressions contradictoires.
    const favoriteRequestRef=useRef<Set<string>>(new Set());

    async function toggleFavorite(vehicleId:string){
      if(favoriteRequestRef.current.has(vehicleId)) return;
      favoriteRequestRef.current.add(vehicleId);
      setPremiumError('');
      try{
        const r=await fetch(`/api/premium/me/favorites/${vehicleId}`,{
          method:'POST',headers:{'Content-Type':'application/json'},body:'{}'
        });
        if(r.status===401){setPremiumError('Sign in as a customer to save vehicles.');toast.error('Sign in as a customer to save vehicles.','Saved vehicles');return;}
        if(!r.ok) throw new Error('Unable to update favorites.');
        const data:{favorite:boolean}=await r.json();
        setFavoriteIds(previous=>data.favorite?[...new Set([...previous,vehicleId])]:previous.filter(id=>id!==vehicleId));
        toast.success(data.favorite?'Added to your saved vehicles.':'Removed from your saved vehicles.','Saved vehicles');
      } catch{setPremiumError('Could not save your selection.');toast.error('Could not save your selection.','Saved vehicles');}
      finally{favoriteRequestRef.current.delete(vehicleId);}
    }
    function toggleCompare(vehicleId:string){
      setPremiumError('');
      setComparedIds(previous=>{
        if(previous.includes(vehicleId)) return previous.filter(id=>id!==vehicleId);
        if(previous.length>=3){setPremiumError('You can compare up to three vehicles.');toast.info('You can compare up to three vehicles.','Compare');return previous;}
        return [...previous,vehicleId];
      });
    }
    const comparedVehicles=vehicles.filter(item=>comparedIds.includes(item.id));

    // Voitures sauvegardées par le client connecté, dans l'ordre
    // du plus récemment ajouté. Alimente la section « Ma sélection ».
    const savedVehicles = useMemo(
        () =>
            favoriteIds
                .map((id) => vehicles.find((item) => item.id === id))
                .filter((item): item is VehicleItem => Boolean(item)),
        [favoriteIds, vehicles],
    );

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
                        <span> recommended fleet</span>
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
                    {/* MA SÉLECTION                                  */}
                    {/* Voitures sauvegardées par le client connecté. */}
                    {/* Mise à jour en direct après chaque « Save ».  */}
                    {/* ============================================= */}

                    {isCustomer && (
                        <section
                            className={styles.savedSection}
                            aria-label="Saved vehicles"
                        >
                            <div className={styles.savedHeading}>
                                <div>
                                    <span className={styles.eyebrow}>
                                        MY SELECTION
                                    </span>

                                    <h2>Your saved cars</h2>
                                </div>

                                <p>
                                    {savedVehicles.length === 0
                                        ? 'Tap ♡ Save on any car to add it here.'
                                        : `${savedVehicles.length} saved`}
                                </p>
                            </div>

                            {savedVehicles.length > 0 && (
                                <div className={styles.savedGrid}>
                                    {savedVehicles.map((vehicle) => (
                                        <article
                                            key={vehicle.id}
                                            className={styles.savedCard}
                                        >
                                            <div className={styles.savedMedia}>
                                                {vehicle.imageUrl ? (
                                                    <img
                                                        src={vehicle.imageUrl}
                                                        alt={`${vehicle.brandName} ${vehicle.modelName}`}
                                                        loading="lazy"
                                                    />
                                                ) : (
                                                    <span className={styles.savedInitial}>
                                                        {vehicle.brandName.charAt(0)}
                                                    </span>
                                                )}
                                            </div>

                                            <div className={styles.savedBody}>
                                                <span>{vehicle.brandName}</span>

                                                <h3>{vehicle.modelName}</h3>

                                                <strong>
                                                    <Price value={vehicle.dailyPrice} />
                                                </strong>

                                                <div className={styles.savedActions}>
                                                    <Link
                                                        href={`/vehicles/${encodeURIComponent(vehicle.id)}`}
                                                    >
                                                        View
                                                    </Link>

                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            void toggleFavorite(vehicle.id)
                                                        }
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            </div>
                                        </article>
                                    ))}
                                </div>
                            )}
                        </section>
                    )}

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

                    {premiumError && <p className={styles.premiumError} role="alert">{premiumError}</p>}
                    {comparedVehicles.length>0 && (
                      <section className={styles.comparePanel} aria-label="Vehicle comparison">
                        <div className={styles.compareHeading}>
                          <h2>Compare the collection</h2>
                          <button type="button" onClick={()=>setComparedIds([])}>Clear</button>
                        </div>
                        <div className={styles.compareScroll}>
                          <table><thead><tr><th>Specification</th>{comparedVehicles.map(v=><th key={v.id}>{v.brandName} {v.modelName}</th>)}</tr></thead>
                          <tbody>
                            {compareRows.map((row) => {
                              const values = comparedVehicles.map((vehicle) =>
                                row.value ? row.value(vehicle) : null,
                              );
                              const best = row.better
                                ? bestCompareIndex(values, row.better)
                                : -1;

                              return (
                                <tr key={row.label}>
                                  <th>{row.label}</th>
                                  {comparedVehicles.map((vehicle, index) => (
                                    <td
                                      key={vehicle.id}
                                      className={
                                        index === best
                                          ? styles.compareBest
                                          : undefined
                                      }
                                      title={
                                        index === best
                                          ? 'Best value'
                                          : undefined
                                      }
                                    >
                                      {row.cell(vehicle)}
                                    </td>
                                  ))}
                                </tr>
                              );
                            })}
                          </tbody></table>
                        </div>
                        {comparedVehicles.length > 1 && (
                          <p className={styles.compareLegend}>
                            <span aria-hidden="true">✓</span> Better value
                          </p>
                        )}
                      </section>
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
                                        premiumActions={{
                                          compared:comparedIds.includes(vehicle.id),
                                          favorite:favoriteIds.includes(vehicle.id),
                                          canFavorite:isCustomer,
                                          onCompare:()=>toggleCompare(vehicle.id),
                                          onFavorite:()=>void toggleFavorite(vehicle.id),
                                        }}
                                        cta={{
                                            label: 'Discover & reserve →',
                                            href: `/vehicles/${encodeURIComponent(vehicle.id)}`,
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
