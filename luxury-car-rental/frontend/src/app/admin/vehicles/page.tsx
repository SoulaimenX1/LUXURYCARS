'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    useCallback,
    useEffect,
    useMemo,
    useState,
    type FormEvent,
} from 'react';

import styles from './vehicles.module.css';

import { formatAmount } from '@/lib/format';
import { useConfirm } from '@/components/confirm-dialog';
import { useToast } from '@/components/toast';

// ==========================================================
// TYPES DES DONNÉES DU BACKEND
// ==========================================================

interface Brand {
    id: string;
    name: string;
}

interface Category {
    id: string;
    name: string;
    description?: string | null;
}

interface VehicleModel {
    id: string;
    brandId: string;
    categoryId: string;
    name: string;
}

interface Vehicle {
    id: string;
    modelId: string;

    model: {
        id: string;
        brandId: string;
        categoryId: string;
        name: string;
    };

    manufactureYear: number;
    licensePlate: string;
    vin: string;

    color: string | null;
    transmission: string;
    fuelType: string;

    seats: number;
    powerHp: number | null;

    dailyPrice: string;
    securityDeposit: string;
    vehicleValue: string;
    mileageKm: number;

    description: string | null;
    status: string;

    createdAt: string;
    updatedAt: string;

    // Photos associées (table vehicle_images).
    images?: VehiclePhoto[];
}

interface VehiclePhoto {
    id: string;
    storagePath: string;
    mediaType: 'image' | 'video';
    posterPath: string | null;
    altText: string | null;
    isPrimary: boolean;
    sortOrder: number;
}

interface ManagementData {
    vehicles: Vehicle[];
    brands: Brand[];
    categories: Category[];
    models: VehicleModel[];
}

interface ApiError {
    message?: string | string[];
}

// ==========================================================
// OUTILS
// ==========================================================

async function readError(
    response: Response,
): Promise<string> {
    try {
        const body: ApiError = await response.json();

        if (Array.isArray(body.message)) {
            return body.message.join(' ');
        }

        if (typeof body.message === 'string') {
            return body.message;
        }
    } catch {
        // Réponse non JSON.
    }

    return `Request failed (HTTP ${response.status}).`;
}

// Accord simple (« 1 model » / « 3 models »).
function pluralize(count: number, singular: string): string {
    return `${count} ${singular}${count === 1 ? '' : 's'}`;
}

// Photo de couverture d'un véhicule : la photo principale si
// elle existe, sinon la première photo disponible. Renvoie
// `null` lorsqu'aucune photo n'est associée.
function primaryImageOf(vehicle: Vehicle): VehiclePhoto | null {
    const images = vehicle.images ?? [];

    return (
        images.find(
            (item) => item.mediaType === 'image' && item.isPrimary,
        ) ??
        images.find((item) => item.mediaType === 'image') ??
        null
    );
}

// Nombre de photos associées à un véhicule.
function imageCountOf(vehicle: Vehicle): number {
    return (vehicle.images ?? []).filter(
        (item) => item.mediaType === 'image',
    ).length;
}

// Nombre de vidéos associées à un véhicule.
function videoCountOf(vehicle: Vehicle): number {
    return (vehicle.images ?? []).filter(
        (item) => item.mediaType === 'video',
    ).length;
}

// ==========================================================
// CATALOGUE : LIGNES ET GESTIONNAIRE
// ==========================================================

// Une entrée supprimable du catalogue (marque, catégorie ou
// modèle), enrichie des informations utiles à l'administrateur.
interface CatalogRow {
    id: string;
    name: string;
    // Clé de chargement, au format « <ressource>:<libellé> ».
    key: string;
    // Utilisation par la flotte (« Used by 3 models »).
    usage: string;
    // Vrai si l'entrée est encore référencée : la suppression
    // entraîne alors la suppression (cascade) des éléments liés.
    cascade: boolean;
    // Résumé des éléments liés, « 5 models and 5 vehicles ».
    cascadeSummary: string;
}

// Trie les entrées du catalogue : les éléments supprimables
// (non utilisés) d'abord, puis par ordre alphabétique.
function compareCatalogRows(a: CatalogRow, b: CatalogRow): number {
    if (a.cascade !== b.cascade) {
        return a.cascade ? 1 : -1;
    }

    return a.name.localeCompare(b.name);
}

// Carte de gestion d'un type d'entrée du catalogue : recherche
// instantanée, nombre d'éléments et suppression par ligne.
function CatalogManager({
    title,
    emptyMessage,
    searchPlaceholder,
    rows,
    deletingKey,
    onDelete,
}: {
    title: string;
    emptyMessage: string;
    searchPlaceholder: string;
    rows: CatalogRow[];
    deletingKey: string;
    onDelete: (row: CatalogRow) => void;
}) {
    const [query, setQuery] = useState('');

    const visibleRows = useMemo(() => {
        const needle = query.trim().toLowerCase();

        if (needle === '') {
            return rows;
        }

        return rows.filter((row) =>
            row.name.toLowerCase().includes(needle),
        );
    }, [rows, query]);

    return (
        <>
            <header className={styles.catalogHead}>
                <h3>{title}</h3>
                <span className={styles.catalogCount}>
                    {rows.length}
                </span>
            </header>

            {rows.length === 0 ? (
                <p className={styles.catalogEmpty}>
                    {emptyMessage}
                </p>
            ) : (
                <>
                    <input
                        type="search"
                        className={styles.catalogSearch}
                        value={query}
                        placeholder={searchPlaceholder}
                        aria-label={searchPlaceholder}
                        onChange={(event) =>
                            setQuery(event.target.value)
                        }
                    />

                    {visibleRows.length === 0 ? (
                        <p className={styles.catalogEmpty}>
                            No match for &quot;{query.trim()}&quot;.
                        </p>
                    ) : (
                        <ul className={styles.catalogList}>
                            {visibleRows.map((row) => (
                                <li
                                    key={row.id}
                                    className={styles.catalogItem}
                                >
                                    <div className={styles.catalogInfo}>
                                        <span
                                            className={styles.catalogName}
                                            title={row.name}
                                        >
                                            {row.name}
                                        </span>

                                        <span
                                            className={
                                                row.cascade
                                                    ? styles.catalogUsageLocked
                                                    : styles.catalogUsage
                                            }
                                        >
                                            {row.usage}
                                        </span>
                                    </div>

                                    <button
                                        type="button"
                                        className={
                                            row.cascade
                                                ? `${styles.catalogDelete} ${styles.catalogDeleteCascade}`
                                                : styles.catalogDelete
                                        }
                                        disabled={
                                            deletingKey === row.key
                                        }
                                        title={
                                            row.cascade
                                                ? `Delete "${row.name}" and its ${row.cascadeSummary}`
                                                : `Delete ${row.name}`
                                        }
                                        onClick={() => onDelete(row)}
                                    >
                                        {deletingKey === row.key
                                            ? 'Deleting...'
                                            : 'Delete'}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </>
            )}
        </>
    );
}

// ==========================================================
// PAGE ADMIN VEHICLES
// ==========================================================

export default function AdminVehiclesPage() {
    const router = useRouter();
    const confirm = useConfirm();
    const toast = useToast();

    // ========================================================
    // DONNÉES PRINCIPALES
    // ========================================================

    const [data, setData] = useState<ManagementData>({
        vehicles: [],
        brands: [],
        categories: [],
        models: [],
    });

    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // ========================================================
    // FORMULAIRE MARQUE
    // ========================================================

    const [brandName, setBrandName] = useState('');

    // ========================================================
    // FORMULAIRE CATÉGORIE
    // ========================================================

    const [categoryName, setCategoryName] = useState('');
    const [categoryDescription, setCategoryDescription] =
        useState('');

    // ========================================================
    // FORMULAIRE MODÈLE
    // ========================================================

    const [modelBrandName, setModelBrandName] = useState('');
    const [modelCategoryName, setModelCategoryName] =
        useState('');
    const [modelName, setModelName] = useState('');

    // ========================================================
    // FORMULAIRE NOUVEAU VÉHICULE
    // ========================================================

    const [vehicleModelId, setVehicleModelId] = useState('');
    const [manufactureYear, setManufactureYear] =
        useState('2026');
    const [licensePlate, setLicensePlate] = useState('');
    const [vin, setVin] = useState('');
    const [color, setColor] = useState('');
    const [transmission, setTransmission] =
        useState('automatic');
    const [fuelType, setFuelType] = useState('petrol');
    const [seats, setSeats] = useState('2');
    const [powerHp, setPowerHp] = useState('');
    const [dailyPrice, setDailyPrice] = useState('');
    const [securityDeposit, setSecurityDeposit] =
        useState('');
    const [vehicleValue, setVehicleValue] = useState('');
    const [mileageKm, setMileageKm] = useState('0');
    const [description, setDescription] = useState('');

    // Caractéristiques éditoriales et éditions.
    const [engine, setEngine] = useState('');
    const [torqueNm, setTorqueNm] = useState('');
    const [acceleration0To100, setAcceleration] =
        useState('');
    const [topSpeedKmh, setTopSpeed] = useState('');
    const [consumptionL100km, setConsumption] =
        useState('');
    const [isSpecial, setIsSpecial] = useState(false);
    const [isLimited, setIsLimited] = useState(false);
    const [editionSize, setEditionSize] = useState('');

    // ========================================================
    // MODIFICATION D'UN VÉHICULE
    // ========================================================

    const [editVehicleId, setEditVehicleId] = useState('');

    const [editDailyPrice, setEditDailyPrice] =
        useState('');
    const [editDeposit, setEditDeposit] = useState('');
    const [editValue, setEditValue] = useState('');
    const [editMileage, setEditMileage] = useState('');
    const [editColor, setEditColor] = useState('');
    const [editDescription, setEditDescription] =
        useState('');
    const [editStatus, setEditStatus] = useState('active');

    // ========================================================
    // FILTRES DE LA FLOTTE
    // ========================================================

    const [fleetSearch, setFleetSearch] = useState('');
    const [fleetBrand, setFleetBrand] = useState('all');
    const [fleetCategory, setFleetCategory] = useState('all');
    const [fleetStatus, setFleetStatus] = useState('all');

    // ========================================================
    // FILTRES DU STUDIO MÉDIA
    // ========================================================

    // Recherche libre (marque, modèle, plaque, VIN).
    const [mediaSearch, setMediaSearch] = useState('');

    // Portée : tous les véhicules, avec ou sans photo.
    const [mediaScope, setMediaScope] = useState<
        'all' | 'with' | 'without'
    >('all');

    // Véhicule retenu dans l'atelier média. La sélection est
    // identifiée par l'identifiant unique du véhicule (jamais par
    // marque ou modèle), afin de cibler la bonne voiture physique.
    const [selectedMediaVehicleId, setSelectedMediaVehicleId] =
        useState('');

    // ========================================================
    // PHOTOS DES VÉHICULES (GESTION DE FLOTTE)
    // ========================================================

    // Fichier image choisi pour chaque immatriculation.
    const [imageFiles, setImageFiles] = useState<
        Record<string, File | null>
    >({});

    // Fichier vidéo choisi pour chaque immatriculation.
    const [videoFiles, setVideoFiles] = useState<
        Record<string, File | null>
    >({});

    // Média en cours d'envoi, au format « <plaque>:<type> ».
    const [uploadingKey, setUploadingKey] = useState('');

    // Média en cours de suppression, même format.
    const [deletingKey, setDeletingKey] = useState('');

    // Onglet actif de la page : flotte, médias ou formulaires.
    const [activeTab, setActiveTab] = useState<
        'fleet' | 'media' | 'forms'
    >('fleet');

    // ========================================================
    // CHARGEMENT DES DONNÉES
    // ========================================================

    const loadData = useCallback(
        async () => {
            setError('');

            try {
                const response = await fetch(
                    '/api/admin/vehicles',
                    {
                        method: 'GET',
                        cache: 'no-store',
                    },
                );

                if (response.status === 401) {
                    router.replace('/login');
                    return;
                }

                if (response.status === 403) {
                    router.replace('/account');
                    return;
                }

                if (!response.ok) {
                    throw new Error(await readError(response));
                }

                const result: ManagementData =
                    await response.json();

                setData({
                    vehicles: Array.isArray(result.vehicles)
                        ? result.vehicles
                        : [],

                    brands: Array.isArray(result.brands)
                        ? result.brands
                        : [],

                    categories: Array.isArray(result.categories)
                        ? result.categories
                        : [],

                    models: Array.isArray(result.models)
                        ? result.models
                        : [],
                });
            } catch (caught) {
                setError(
                    caught instanceof Error
                        ? caught.message
                        : 'Unable to load fleet.',
                );
            } finally {
                setLoading(false);
            }
        },
        [router],
    );

    useEffect(() => {
        // Exécuter le chargement de manière asynchrone
        // pour respecter les règles React 19.
        const timerId = window.setTimeout(
            () => {
                void loadData();
            },
            0,
        );

        return () => {
            window.clearTimeout(timerId);
        };
    }, [loadData]);

    // ========================================================
    // INDEX POUR RETROUVER MARQUE ET CATÉGORIE
    // ========================================================

    const brandsById = useMemo(
        () =>
            new Map(
                data.brands.map((brand) => [
                    brand.id,
                    brand,
                ]),
            ),
        [data.brands],
    );

    const categoriesById = useMemo(
        () =>
            new Map(
                data.categories.map((category) => [
                    category.id,
                    category,
                ]),
            ),
        [data.categories],
    );

    // ========================================================
    // UTILISATION DU CATALOGUE
    // ========================================================
    //
    // Une marque / catégorie / modèle ne peut être supprimé que
    // s'il n'est plus utilisé par la flotte. On pré-calcule ces
    // compteurs pour verrouiller les lignes concernées et éviter
    // à l'administrateur une suppression refusée par le serveur.

    const modelsPerBrand = useMemo(() => {
        const counts = new Map<string, number>();

        for (const model of data.models) {
            counts.set(
                model.brandId,
                (counts.get(model.brandId) ?? 0) + 1,
            );
        }

        return counts;
    }, [data.models]);

    const modelsPerCategory = useMemo(() => {
        const counts = new Map<string, number>();

        for (const model of data.models) {
            counts.set(
                model.categoryId,
                (counts.get(model.categoryId) ?? 0) + 1,
            );
        }

        return counts;
    }, [data.models]);

    const vehiclesPerModel = useMemo(() => {
        const counts = new Map<string, number>();

        for (const vehicle of data.vehicles) {
            counts.set(
                vehicle.modelId,
                (counts.get(vehicle.modelId) ?? 0) + 1,
            );
        }

        return counts;
    }, [data.vehicles]);

    // Nombre de véhicules par marque (via le modèle du véhicule).
    const vehiclesPerBrand = useMemo(() => {
        const counts = new Map<string, number>();

        for (const vehicle of data.vehicles) {
            const brandId = vehicle.model.brandId;

            counts.set(
                brandId,
                (counts.get(brandId) ?? 0) + 1,
            );
        }

        return counts;
    }, [data.vehicles]);

    // Nombre de véhicules par catégorie.
    const vehiclesPerCategory = useMemo(() => {
        const counts = new Map<string, number>();

        for (const vehicle of data.vehicles) {
            const categoryId = vehicle.model.categoryId;

            counts.set(
                categoryId,
                (counts.get(categoryId) ?? 0) + 1,
            );
        }

        return counts;
    }, [data.vehicles]);

    const brandRows: CatalogRow[] = data.brands
        .map((brand) => {
            const models = modelsPerBrand.get(brand.id) ?? 0;
            const vehicles =
                vehiclesPerBrand.get(brand.id) ?? 0;

            return {
                id: brand.id,
                name: brand.name,
                key: `brand:${brand.name}`,
                usage:
                    models === 0
                        ? 'Unused'
                        : `Used by ${pluralize(models, 'model')}`,
                cascade: models > 0,
                cascadeSummary: `${pluralize(
                    models,
                    'model',
                )} and ${pluralize(vehicles, 'vehicle')}`,
            };
        })
        .sort(compareCatalogRows);

    const categoryRows: CatalogRow[] = data.categories
        .map((category) => {
            const models =
                modelsPerCategory.get(category.id) ?? 0;
            const vehicles =
                vehiclesPerCategory.get(category.id) ?? 0;

            return {
                id: category.id,
                name: category.name,
                key: `category:${category.name}`,
                usage:
                    models === 0
                        ? 'Unused'
                        : `Used by ${pluralize(models, 'model')}`,
                cascade: models > 0,
                cascadeSummary: `${pluralize(
                    models,
                    'model',
                )} and ${pluralize(vehicles, 'vehicle')}`,
            };
        })
        .sort(compareCatalogRows);

    const modelRows: CatalogRow[] = data.models
        .map((model) => {
            const used = vehiclesPerModel.get(model.id) ?? 0;

            const brandName =
                brandsById.get(model.brandId)?.name ?? '';

            const label = `${brandName} ${model.name}`.trim();

            return {
                id: model.id,
                name: label,
                key: `model:${label}`,
                usage:
                    used === 0
                        ? 'Unused'
                        : `Used by ${pluralize(used, 'vehicle')}`,
                cascade: used > 0,
                cascadeSummary: pluralize(used, 'vehicle'),
            };
        })
        .sort(compareCatalogRows);

    // ========================================================
    // FILTRAGE DE LA FLOTTE
    // ========================================================

    const fleetStatuses = useMemo(
        () =>
            Array.from(
                new Set(
                    data.vehicles.map(
                        (vehicle) => vehicle.status,
                    ),
                ),
            ).sort(),
        [data.vehicles],
    );

    const hasFleetFilters =
        fleetSearch.trim() !== '' ||
        fleetBrand !== 'all' ||
        fleetCategory !== 'all' ||
        fleetStatus !== 'all';

    const filteredFleet = useMemo(() => {
        const query = fleetSearch.trim().toLowerCase();

        return data.vehicles.filter((vehicle) => {
            const brandName =
                brandsById.get(
                    vehicle.model.brandId,
                )?.name ?? '';

            const categoryName =
                categoriesById.get(
                    vehicle.model.categoryId,
                )?.name ?? '';

            const searchableText = [
                brandName,
                vehicle.model.name,
                vehicle.licensePlate,
                vehicle.vin,
                categoryName,
            ]
                .join(' ')
                .toLowerCase();

            const matchesSearch =
                query === '' ||
                searchableText.includes(query);

            const matchesBrand =
                fleetBrand === 'all' ||
                brandName === fleetBrand;

            const matchesCategory =
                fleetCategory === 'all' ||
                categoryName === fleetCategory;

            const matchesStatus =
                fleetStatus === 'all' ||
                vehicle.status === fleetStatus;

            return (
                matchesSearch &&
                matchesBrand &&
                matchesCategory &&
                matchesStatus
            );
        });
    }, [
        data.vehicles,
        fleetSearch,
        fleetBrand,
        fleetCategory,
        fleetStatus,
        brandsById,
        categoriesById,
    ]);

    function resetFleetFilters() {
        setFleetSearch('');
        setFleetBrand('all');
        setFleetCategory('all');
        setFleetStatus('all');
    }

    // ========================================================
    // FILTRAGE DU STUDIO MÉDIA
    // ========================================================

    const hasMediaFilters =
        mediaSearch.trim() !== '' ||
        mediaScope !== 'all';

    const filteredMedia = useMemo(() => {
        const query = mediaSearch.trim().toLowerCase();

        return data.vehicles.filter((vehicle) => {
            const brandName =
                brandsById.get(
                    vehicle.model.brandId,
                )?.name ?? '';

            const searchableText = [
                brandName,
                vehicle.model.name,
                vehicle.licensePlate,
                vehicle.vin,
            ]
                .join(' ')
                .toLowerCase();

            const matchesSearch =
                query === '' ||
                searchableText.includes(query);

            const media = vehicle.images ?? [];

            const hasPhoto = media.some(
                (item) => item.mediaType === 'image',
            );

            const matchesScope =
                mediaScope === 'all' ||
                (mediaScope === 'with'
                    ? hasPhoto
                    : !hasPhoto);

            return matchesSearch && matchesScope;
        });
    }, [
        data.vehicles,
        mediaSearch,
        mediaScope,
        brandsById,
    ]);

    function resetMediaFilters() {
        setMediaSearch('');
        setMediaScope('all');
    }

    // ========================================================
    // ATELIER MÉDIA : VÉHICULE RETENU ET MÉDIAS ASSOCIÉS
    // ========================================================
    //
    // La sélection est dérivée de la liste filtrée : si le
    // véhicule retenu quitte le filtre, on retombe sur le
    // premier résultat (sans effet secondaire ni état fantôme).

    const selectedMediaVehicle = useMemo(() => {
        if (filteredMedia.length === 0) {
            return null;
        }

        return (
            filteredMedia.find(
                (vehicle) => vehicle.id === selectedMediaVehicleId,
            ) ??
            filteredMedia[0] ??
            null
        );
    }, [filteredMedia, selectedMediaVehicleId]);

    const selectedMediaBrand = selectedMediaVehicle
        ? brandsById.get(selectedMediaVehicle.model.brandId)
        : undefined;

    // Toutes les photos (couverture + galerie) et vidéos du
    // véhicule retenu, telles que renvoyées par le backend.
    const selectedMediaImages = useMemo(
        () =>
            (selectedMediaVehicle?.images ?? []).filter(
                (item) => item.mediaType === 'image',
            ),
        [selectedMediaVehicle],
    );

    const selectedMediaVideos = useMemo(
        () =>
            (selectedMediaVehicle?.images ?? []).filter(
                (item) => item.mediaType === 'video',
            ),
        [selectedMediaVehicle],
    );

    const selectedMediaCover =
        selectedMediaImages.find((item) => item.isPrimary) ??
        selectedMediaImages[0] ??
        null;

    const selectedMediaGallery = selectedMediaCover
        ? selectedMediaImages.filter(
              (item) => item.id !== selectedMediaCover.id,
          )
        : selectedMediaImages;

    const selectedMediaPlate = selectedMediaVehicle?.licensePlate ?? '';

    const selectedMediaUploading =
        selectedMediaPlate !== '' &&
        uploadingKey === `${selectedMediaPlate}:image`;

    const selectedMediaDeleting =
        selectedMediaPlate !== '' &&
        deletingKey === `${selectedMediaPlate}:image`;

    const selectedMediaFile = selectedMediaPlate
        ? imageFiles[selectedMediaPlate] ?? null
        : null;

    // Valeurs scalaires prêtes à l'affichage (évite toute
    // dépendance au rétrécissement de type dans les rappels).
    const selectedMediaId = selectedMediaVehicle?.id ?? '';
    const selectedMediaBrandName = selectedMediaBrand?.name ?? 'Luxury';
    const selectedMediaModelName = selectedMediaVehicle?.model.name ?? '';
    const selectedMediaYear = selectedMediaVehicle?.manufactureYear ?? null;
    const selectedMediaColor = selectedMediaVehicle?.color ?? '';

    // ========================================================
    // VÉHICULE SÉLECTIONNÉ POUR MODIFICATION
    // ========================================================

    const selectedEditVehicle =
        data.vehicles.find(
            (vehicle) => vehicle.id === editVehicleId,
        ) ?? null;

    // ========================================================
    // POST GÉNÉRIQUE
    // ========================================================

    async function createResource(
        resource:
            | 'brand'
            | 'category'
            | 'model'
            | 'vehicle',
        payload: Record<string, unknown>,
        successMessage: string,
    ) {
        setActionLoading(true);
        setError('');
        setSuccess('');

        try {
            const response = await fetch(
                '/api/admin/vehicles',
                {
                    method: 'POST',

                    headers: {
                        'Content-Type': 'application/json',
                    },

                    body: JSON.stringify({
                        resource,
                        data: payload,
                    }),
                },
            );

            if (!response.ok) {
                throw new Error(await readError(response));
            }

            setSuccess(successMessage);
            toast.success(successMessage, 'Catalogue');

            await loadData();
        } catch (caught) {
            const message =
                caught instanceof Error
                    ? caught.message
                    : 'Operation failed.';
            setError(message);
            toast.error(message, 'Catalogue');
        } finally {
            setActionLoading(false);
        }
    }

    // ========================================================
    // AJOUTER UNE MARQUE
    // ========================================================

    async function submitBrand(
        event: FormEvent<HTMLFormElement>,
    ) {
        event.preventDefault();

        const name = brandName.trim();

        if (name.length < 2) {
            setError(
                'Brand name must contain at least 2 characters.',
            );
            return;
        }

        await createResource(
            'brand',
            { name },
            `Brand ${name} created successfully.`,
        );

        setBrandName('');
    }

    // ========================================================
    // AJOUTER UNE CATÉGORIE
    // ========================================================

    async function submitCategory(
        event: FormEvent<HTMLFormElement>,
    ) {
        event.preventDefault();

        const name = categoryName.trim();

        if (name.length < 2) {
            setError(
                'Category name must contain at least 2 characters.',
            );
            return;
        }

        await createResource(
            'category',
            {
                name,

                ...(categoryDescription.trim()
                    ? {
                        description:
                            categoryDescription.trim(),
                    }
                    : {}),
            },
            `Category ${name} created successfully.`,
        );

        setCategoryName('');
        setCategoryDescription('');
    }

    // ========================================================
    // AJOUTER UN MODÈLE
    // ========================================================

    async function submitModel(
        event: FormEvent<HTMLFormElement>,
    ) {
        event.preventDefault();

        if (
            !modelBrandName ||
            !modelCategoryName ||
            !modelName.trim()
        ) {
            setError(
                'Brand, category and model name are required.',
            );
            return;
        }

        await createResource(
            'model',
            {
                brandName: modelBrandName,
                categoryName: modelCategoryName,
                name: modelName.trim(),
            },
            `Model ${modelName.trim()} created successfully.`,
        );

        setModelName('');
    }

    // ========================================================
    // AJOUTER UN VÉHICULE
    // ========================================================

    async function submitVehicle(
        event: FormEvent<HTMLFormElement>,
    ) {
        event.preventDefault();

        const selectedModel = data.models.find(
            (model) => model.id === vehicleModelId,
        );

        if (!selectedModel) {
            setError('Please select a vehicle model.');
            return;
        }

        // La valeur du véhicule doit toujours être un nombre réel > 0.
        if (
            !vehicleValue.trim() ||
            !Number.isFinite(Number(vehicleValue)) ||
            Number(vehicleValue) <= 0
        ) {
            setError(
                'Vehicle value is required and must be a positive number.',
            );
            return;
        }

        const brand = brandsById.get(
            selectedModel.brandId,
        );

        if (!brand) {
            setError(
                'Unable to identify the selected brand.',
            );
            return;
        }

        const payload: Record<string, unknown> = {
            brandName: brand.name,
            modelName: selectedModel.name,

            manufactureYear:
                Number(manufactureYear),

            licensePlate:
                licensePlate.trim().toUpperCase(),

            vin:
                vin.trim().toUpperCase(),

            transmission,
            fuelType,

            seats:
                Number(seats),

            dailyPrice:
                Number(dailyPrice),

            securityDeposit:
                Number(securityDeposit),

            vehicleValue:
                Number(vehicleValue),

            mileageKm:
                Number(mileageKm),
        };

        if (color.trim()) {
            payload.color = color.trim();
        }

        if (powerHp.trim()) {
            payload.powerHp = Number(powerHp);
        }

        if (description.trim()) {
            payload.description = description.trim();
        }

        // Caractéristiques éditoriales.
        if (engine.trim()) {
            payload.engine = engine.trim();
        }

        if (torqueNm.trim()) {
            payload.torqueNm = Number(torqueNm);
        }

        if (acceleration0To100.trim()) {
            payload.acceleration0To100 = Number(
                acceleration0To100,
            );
        }

        if (topSpeedKmh.trim()) {
            payload.topSpeedKmh = Number(topSpeedKmh);
        }

        if (consumptionL100km.trim()) {
            payload.consumptionL100km = Number(
                consumptionL100km,
            );
        }

        // Éditions — le type de notification est déduit
        // automatiquement côté backend.
        if (isLimited) {
            payload.isLimited = true;

            if (editionSize.trim()) {
                payload.editionSize = Number(editionSize);
            }
        } else if (isSpecial) {
            payload.isSpecial = true;
        }

        await createResource(
            'vehicle',
            payload,
            'Vehicle added to the fleet.',
        );

        setLicensePlate('');
        setVin('');
        setColor('');
        setPowerHp('');
        setDailyPrice('');
        setSecurityDeposit('');
        setVehicleValue('');
        setMileageKm('0');
        setDescription('');
        setEngine('');
        setTorqueNm('');
        setAcceleration('');
        setTopSpeed('');
        setConsumption('');
        setIsSpecial(false);
        setIsLimited(false);
        setEditionSize('');
    }

    // ========================================================
    // CHOISIR UN VÉHICULE À MODIFIER
    // ========================================================

    function selectVehicleForEdit(vehicleId: string) {
        setEditVehicleId(vehicleId);

        const vehicle = data.vehicles.find(
            (item) => item.id === vehicleId,
        );

        if (!vehicle) {
            return;
        }

        setEditDailyPrice(vehicle.dailyPrice);
        setEditDeposit(vehicle.securityDeposit);
        setEditValue(vehicle.vehicleValue);
        setEditMileage(
            String(vehicle.mileageKm),
        );
        setEditColor(vehicle.color ?? '');
        setEditDescription(
            vehicle.description ?? '',
        );
        setEditStatus(vehicle.status);
    }

    // ========================================================
    // ACTIVER / DÉSACTIVER UN VÉHICULE (RACCOURCI)
    // ========================================================

    async function toggleVehicleStatus(vehicle: Vehicle) {
        const nextStatus =
            vehicle.status === 'active'
                ? 'inactive'
                : 'active';

        const approved = await confirm({
            title:
                nextStatus === 'active'
                    ? 'Activate vehicle'
                    : 'Deactivate vehicle',
            message:
                nextStatus === 'active'
                    ? `${vehicle.licensePlate} will become available to customers again.`
                    : `${vehicle.licensePlate} will be hidden from customers. Existing reservations and history are preserved.`,
            confirmLabel:
                nextStatus === 'active'
                    ? 'Activate'
                    : 'Deactivate',
            tone: nextStatus === 'active' ? 'success' : 'danger',
        });
        if (!approved) {
            return;
        }

        setActionLoading(true);
        setError('');
        setSuccess('');

        try {
            const response = await fetch(
                '/api/admin/vehicles',
                {
                    method: 'PATCH',

                    headers: {
                        'Content-Type': 'application/json',
                    },

                    body: JSON.stringify({
                        licensePlate: vehicle.licensePlate,

                        data: {
                            status: nextStatus,
                        },
                    }),
                },
            );

            if (!response.ok) {
                throw new Error(await readError(response));
            }

            const message =
                nextStatus === 'active'
                    ? `${vehicle.licensePlate} is now available to customers.`
                    : `${vehicle.licensePlate} is now inactive and hidden from customers.`;
            setSuccess(message);
            toast.success(message, 'Fleet status');

            await loadData();
        } catch (caught) {
            const failure =
                caught instanceof Error
                    ? caught.message
                    : 'Unable to update vehicle status.';
            setError(failure);
            toast.error(failure, 'Fleet status');
        } finally {
            setActionLoading(false);
        }
    }

    // ========================================================
    // MODIFIER UN VÉHICULE
    // ========================================================

    async function updateVehicle(
        event: FormEvent<HTMLFormElement>,
    ) {
        event.preventDefault();

        if (!selectedEditVehicle) {
            setError('Please select a vehicle.');
            return;
        }

        setActionLoading(true);
        setError('');
        setSuccess('');

        try {
            const response = await fetch(
                '/api/admin/vehicles',
                {
                    method: 'PATCH',

                    headers: {
                        'Content-Type': 'application/json',
                    },

                    body: JSON.stringify({
                        licensePlate:
                            selectedEditVehicle.licensePlate,

                        data: {
                            dailyPrice:
                                Number(editDailyPrice),

                            securityDeposit:
                                Number(editDeposit),

                            vehicleValue:
                                Number(editValue),

                            mileageKm:
                                Number(editMileage),

                            color:
                                editColor.trim(),

                            description:
                                editDescription.trim(),

                            status: editStatus,
                        },
                    }),
                },
            );

            if (!response.ok) {
                throw new Error(await readError(response));
            }

            const message = `${selectedEditVehicle.licensePlate} updated successfully.`;
            setSuccess(message);
            toast.success(message, 'Vehicle updated');

            await loadData();
        } catch (caught) {
            const failure =
                caught instanceof Error
                    ? caught.message
                    : 'Unable to update vehicle.';
            setError(failure);
            toast.error(failure, 'Vehicle updated');
        } finally {
            setActionLoading(false);
        }
    }

    // ========================================================
    // ENVOYER UN MÉDIA (PHOTO OU VIDÉO) D'UN VÉHICULE
    // ========================================================

    async function uploadVehicleMedia(
        plate: string,
        kind: 'image' | 'video',
    ) {
        const file =
            kind === 'video'
                ? videoFiles[plate]
                : imageFiles[plate];

        if (!file) {
            setError(
                kind === 'video'
                    ? 'Select a video file from your computer first.'
                    : 'Select an image file from your computer first.',
            );
            return;
        }

        const key = `${plate}:${kind}`;

        setUploadingKey(key);
        setError('');
        setSuccess('');

        try {
            const form = new FormData();

            form.append('licensePlate', plate);
            form.append(kind, file);

            const response = await fetch(
                `/api/admin/vehicles/${kind}`,
                {
                    method: 'POST',
                    body: form,
                },
            );

            if (response.status === 401) {
                router.replace('/login');
                return;
            }

            if (response.status === 403) {
                router.replace('/account');
                return;
            }

            if (!response.ok) {
                throw new Error(await readError(response));
            }

            const message =
                kind === 'video'
                    ? `Video updated for ${plate}.`
                    : `Photo updated for ${plate}.`;
            setSuccess(message);
            toast.success(message, 'Vehicle media');

            // Vider la sélection de cette ligne.
            if (kind === 'video') {
                setVideoFiles((previous) => ({
                    ...previous,
                    [plate]: null,
                }));
            } else {
                setImageFiles((previous) => ({
                    ...previous,
                    [plate]: null,
                }));
            }

            await loadData();
        } catch (caught) {
            const failure =
                caught instanceof Error
                    ? caught.message
                    : 'Unable to upload file.';
            setError(failure);
            toast.error(failure, 'Vehicle media');
        } finally {
            setUploadingKey('');
        }
    }

    // ========================================================
    // SUPPRIMER UN MÉDIA (PHOTO OU VIDÉO) D'UN VÉHICULE
    // ========================================================

    async function deleteVehicleMedia(
        plate: string,
        kind: 'image' | 'video',
        count = 1,
    ) {
        const label = kind === 'video' ? 'video' : 'photo';

        // Le point d'entrée « by-plate » supprime TOUS les médias
        // du même type pour la voiture (couverture + galerie). Le
        // message doit donc refléter exactement ce qui sera effacé.
        const message =
            count > 1
                ? `All ${count} ${label}s of ${plate} will be permanently removed, including gallery images. This action cannot be undone.`
                : `The ${label} of ${plate} will be permanently removed. This action cannot be undone.`;

        const approved = await confirm({
            title:
                count > 1
                    ? `Delete all ${label}s`
                    : `Delete ${label}`,
            message,
            confirmLabel: 'Delete',
            tone: 'danger',
        });
        if (!approved) {
            return;
        }

        setDeletingKey(`${plate}:${kind}`);
        setError('');
        setSuccess('');

        try {
            const response = await fetch(
                `/api/admin/vehicles/${kind}?licensePlate=${encodeURIComponent(
                    plate,
                )}`,
                {
                    method: 'DELETE',
                },
            );

            if (response.status === 401) {
                router.replace('/login');
                return;
            }

            if (response.status === 403) {
                router.replace('/account');
                return;
            }

            if (!response.ok) {
                throw new Error(await readError(response));
            }

            const message =
                kind === 'video'
                    ? `Video removed for ${plate}.`
                    : `Photo removed for ${plate}.`;
            setSuccess(message);
            toast.success(message, 'Vehicle media');

            await loadData();
        } catch (caught) {
            const failure =
                caught instanceof Error
                    ? caught.message
                    : 'Unable to delete file.';
            setError(failure);
            toast.error(failure, 'Vehicle media');
        } finally {
            setDeletingKey('');
        }
    }

    // ========================================================
    // SUPPRIMER UNE RESSOURCE DU CATALOGUE OU UN VÉHICULE
    // ========================================================
    //
    // - brand / category / model : suppression du catalogue.
    // - vehicle : suppression d'une voiture de la flotte.
    //
    // Le backend refuse (409) une suppression qui violerait
    // une contrainte de clé étrangère (RESTRICT).

    async function deleteResource(
        resource:
            | 'brand'
            | 'category'
            | 'model'
            | 'vehicle',
        label: string,
        params: {
            id?: string;
            licensePlate?: string;
        },
        options?: {
            force?: boolean;
            cascadeSummary?: string;
        },
    ) {
        const isVehicle = resource === 'vehicle';

        const approved = await confirm({
            title: `Delete ${label}?`,
            message: isVehicle
                ? `Vehicle "${label}" will be removed from the fleet permanently. This action cannot be undone.`
                : options?.force
                    ? `"${label}" is still used by ${
                          options.cascadeSummary ??
                          'related items'
                      }. Deleting it will also permanently remove those linked items. Vehicles with reservations or reviews are protected and will block the deletion. This action cannot be undone.`
                    : `"${label}" will be removed from the collection permanently. This action cannot be undone.`,
            confirmLabel: 'Delete',
            tone: 'danger',
        });

        if (!approved) {
            return;
        }

        setDeletingKey(`${resource}:${label}`);
        setError('');
        setSuccess('');

        const query = new URLSearchParams({ resource });

        if (params.id) {
            query.set('id', params.id);
        }

        if (params.licensePlate) {
            query.set(
                'licensePlate',
                params.licensePlate,
            );
        }

        // Demande la suppression en cascade au serveur.
        if (options?.force && !isVehicle) {
            query.set('force', 'true');
        }

        try {
            const response = await fetch(
                `/api/admin/vehicles?${query.toString()}`,
                {
                    method: 'DELETE',
                },
            );

            if (response.status === 401) {
                router.replace('/login');
                return;
            }

            if (response.status === 403) {
                router.replace('/account');
                return;
            }

            if (!response.ok) {
                throw new Error(await readError(response));
            }

            const message = `${label} deleted successfully.`;
            setSuccess(message);
            toast.success(message, 'Catalogue');

            await loadData();
        } catch (caught) {
            const failure =
                caught instanceof Error
                    ? caught.message
                    : 'Unable to delete resource.';
            setError(failure);
            toast.error(failure, 'Catalogue');
        } finally {
            setDeletingKey('');
        }
    }

    // ========================================================
    // INTERFACE
    // ========================================================

    // Nombre de voitures sans photo (utile pour l'onglet Médias).
    const vehiclesWithoutPhoto = data.vehicles.filter(
        (vehicle) =>
            !(vehicle.images ?? []).some(
                (item) => item.mediaType === 'image',
            ),
    ).length;

    // Classe d'une section selon l'onglet actif : les sections
    // des autres onglets sont masquées (display: none).
    function tabClass(
        tab: 'fleet' | 'media' | 'forms',
    ) {
        return `${styles.section} ${
            activeTab === tab ? '' : styles.tabHidden
        }`;
    }

    return (
        <main className={styles.page}>

            <div className={styles.container}>

                {/* ================================================= */}
                {/* HERO                                             */}
                {/* ================================================= */}

                <section className={styles.hero}>
                    <div>

                        <Link
                            href="/admin"
                            className={styles.back}
                        >
                            ← Back to overview
                        </Link>

                        <p className={styles.eyebrow}>
                            THE PRIVATE OFFICE / 04
                        </p>

                        <h1>
                            Fleet <em>atelier</em>
                        </h1>

                        <p className={styles.subtitle}>
                            Curate the collection.
                        </p>

                    </div>

                    <div className={styles.heroMetric}>
                        <strong>
                            {String(data.vehicles.length).padStart(
                                2,
                                '0',
                            )}
                        </strong>

                        <span>
                            VEHICLES
                        </span>
                    </div>
                </section>

                {/* ================================================= */}
                {/* MESSAGES                                         */}
                {/* ================================================= */}

                {error && (
                    <div
                        className={styles.error}
                        role="alert"
                    >
                        {error}
                    </div>
                )}

                {success && (
                    <div
                        className={styles.success}
                        role="status"
                    >
                        {success}
                    </div>
                )}

                {/* ================================================= */}
                {/* ONGLETS                                          */}
                {/* ================================================= */}

                <nav
                    className={styles.tabs}
                    aria-label="Fleet management"
                >
                    <button
                        type="button"
                        className={
                            activeTab === 'fleet'
                                ? styles.tabActive
                                : undefined
                        }
                        aria-current={
                            activeTab === 'fleet'
                                ? 'page'
                                : undefined
                        }
                        onClick={() => setActiveTab('fleet')}
                    >
                        Fleet
                        <span>
                            {data.vehicles.length}
                        </span>
                    </button>

                    <button
                        type="button"
                        className={
                            activeTab === 'media'
                                ? styles.tabActive
                                : undefined
                        }
                        aria-current={
                            activeTab === 'media'
                                ? 'page'
                                : undefined
                        }
                        onClick={() => setActiveTab('media')}
                    >
                        Media
                        {vehiclesWithoutPhoto > 0 && (
                            <span title="Vehicles without a photo">
                                {vehiclesWithoutPhoto}
                            </span>
                        )}
                    </button>

                    <button
                        type="button"
                        className={
                            activeTab === 'forms'
                                ? styles.tabActive
                                : undefined
                        }
                        aria-current={
                            activeTab === 'forms'
                                ? 'page'
                                : undefined
                        }
                        onClick={() => setActiveTab('forms')}
                    >
                        Forms
                    </button>
                </nav>

                {/* ================================================= */}
                {/* FLEET                                            */}
                {/* ================================================= */}

                <section className={tabClass('fleet')}>

                    <div className={styles.sectionHeader}>
                        <p className={styles.eyebrow}>
                            COLLECTION
                        </p>

                        <h2>
                            The fleet
                        </h2>
                    </div>

                    {loading ? (
                        <p className={styles.loading}>
                            Loading collection...
                        </p>
                    ) : (
                        <>
                            {/* Filtres de la flotte */}

                            <div className={styles.fleetFilters}>
                                <div className={styles.field}>
                                    <label htmlFor="fleet-search">
                                        Search
                                    </label>

                                    <input
                                        id="fleet-search"
                                        type="search"
                                        placeholder="Brand, model, plate or VIN..."
                                        value={fleetSearch}
                                        onChange={(event) =>
                                            setFleetSearch(event.target.value)
                                        }
                                    />
                                </div>

                                <div className={styles.field}>
                                    <label htmlFor="fleet-brand">
                                        Brand
                                    </label>

                                    <select
                                        id="fleet-brand"
                                        value={fleetBrand}
                                        onChange={(event) =>
                                            setFleetBrand(event.target.value)
                                        }
                                    >
                                        <option value="all">
                                            All brands
                                        </option>

                                        {data.brands.map((brand) => (
                                            <option
                                                key={brand.id}
                                                value={brand.name}
                                            >
                                                {brand.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className={styles.field}>
                                    <label htmlFor="fleet-category">
                                        Category
                                    </label>

                                    <select
                                        id="fleet-category"
                                        value={fleetCategory}
                                        onChange={(event) =>
                                            setFleetCategory(event.target.value)
                                        }
                                    >
                                        <option value="all">
                                            All categories
                                        </option>

                                        {data.categories.map((category) => (
                                            <option
                                                key={category.id}
                                                value={category.name}
                                            >
                                                {category.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className={styles.field}>
                                    <label htmlFor="fleet-status">
                                        Status
                                    </label>

                                    <select
                                        id="fleet-status"
                                        value={fleetStatus}
                                        onChange={(event) =>
                                            setFleetStatus(event.target.value)
                                        }
                                    >
                                        <option value="all">
                                            All statuses
                                        </option>

                                        {fleetStatuses.map((status) => (
                                            <option key={status} value={status}>
                                                {status}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className={styles.fleetMeta}>
                                <span>
                                    Showing {filteredFleet.length}
                                    {' '}
                                    of {data.vehicles.length}
                                    {' '}
                                    vehicles
                                </span>

                                {hasFleetFilters && (
                                    <button
                                        type="button"
                                        onClick={resetFleetFilters}
                                    >
                                        Clear filters
                                    </button>
                                )}
                            </div>

                            {filteredFleet.length === 0 ? (
                                <div className={styles.fleetEmpty}>
                                    <p>
                                        No vehicles match your filters.
                                    </p>

                                    <button
                                        type="button"
                                        onClick={resetFleetFilters}
                                    >
                                        Clear filters
                                    </button>
                                </div>
                            ) : (
                                <div className={styles.vehicleGrid}>

                                    {filteredFleet.map((vehicle) => {
                                        const brand =
                                            brandsById.get(
                                                vehicle.model.brandId,
                                            );

                                        const category =
                                            categoriesById.get(
                                                vehicle.model.categoryId,
                                            );

                                        const brandLabel =
                                            brand?.name ?? 'Luxury';

                                        const primaryImage =
                                            (vehicle.images ?? []).find(
                                                (item) =>
                                                    item.mediaType ===
                                                        'image' &&
                                                    item.isPrimary,
                                            ) ??
                                            (vehicle.images ?? []).find(
                                                (item) =>
                                                    item.mediaType ===
                                                    'image',
                                            );

                                        return (
                                            <article
                                                key={vehicle.id}
                                                className={styles.vehicleCard}
                                            >
                                                <figure
                                                    className={
                                                        styles.vehicleFigure
                                                    }
                                                >
                                                    <button
                                                        type="button"
                                                        className={`${styles.statusButton} ${
                                                            vehicle.status ===
                                                            'active'
                                                                ? styles.statusButtonActive
                                                                : styles.statusButtonInactive
                                                        }`}
                                                        disabled={actionLoading}
                                                        aria-pressed={
                                                            vehicle.status ===
                                                            'active'
                                                        }
                                                        title={
                                                            vehicle.status ===
                                                            'active'
                                                                ? 'Active — click to hide this car from customers'
                                                                : 'Hidden from customers — click to activate'
                                                        }
                                                        onClick={() =>
                                                            void toggleVehicleStatus(
                                                                vehicle,
                                                            )
                                                        }
                                                    >
                                                        {vehicle.status}
                                                    </button>

                                                    {primaryImage ? (
                                                        <img
                                                            className={
                                                                styles.vehiclePhoto
                                                            }
                                                            src={
                                                                primaryImage.storagePath
                                                            }
                                                            alt={
                                                                primaryImage.altText ??
                                                                `${brandLabel} ${vehicle.model.name}`
                                                            }
                                                            loading="lazy"
                                                        />
                                                    ) : (
                                                        <span
                                                            className={
                                                                styles.vehiclePhotoEmpty
                                                            }
                                                            aria-hidden="true"
                                                        >
                                                            {brandLabel}
                                                        </span>
                                                    )}

                                                    <figcaption
                                                        className={
                                                            styles.vehicleYear
                                                        }
                                                    >
                                                        {
                                                            vehicle.manufactureYear
                                                        }
                                                    </figcaption>
                                                </figure>

                                                <div
                                                    className={
                                                        styles.vehicleBody
                                                    }
                                                >
                                                    <p
                                                        className={
                                                            styles.category
                                                        }
                                                    >
                                                        {category?.name ??
                                                            'Premium'}
                                                    </p>

                                                    <h3>
                                                        {brandLabel}{' '}
                                                        {vehicle.model.name}
                                                    </h3>

                                                    <p
                                                        className={
                                                            styles.vehicleIdentity
                                                        }
                                                    >
                                                        <span
                                                            className={
                                                                styles.plate
                                                            }
                                                        >
                                                            {
                                                                vehicle.licensePlate
                                                            }
                                                        </span>

                                                        <span
                                                            className={
                                                                styles.vin
                                                            }
                                                            title={vehicle.vin}
                                                        >
                                                            {vehicle.vin}
                                                        </span>
                                                    </p>

                                                    <dl
                                                        className={
                                                            styles.vehicleSpecs
                                                        }
                                                    >
                                                        <div>
                                                            <dt>
                                                                Transmission
                                                            </dt>
                                                            <dd>
                                                                {
                                                                    vehicle.transmission
                                                                }
                                                            </dd>
                                                        </div>

                                                        <div>
                                                            <dt>Fuel</dt>
                                                            <dd>
                                                                {
                                                                    vehicle.fuelType
                                                                }
                                                            </dd>
                                                        </div>

                                                        <div>
                                                            <dt>Power</dt>
                                                            <dd>
                                                                {vehicle.powerHp
                                                                    ? `${vehicle.powerHp} hp`
                                                                    : '—'}
                                                            </dd>
                                                        </div>

                                                        <div>
                                                            <dt>Seats</dt>
                                                            <dd>
                                                                {vehicle.seats}
                                                            </dd>
                                                        </div>

                                                        <div>
                                                            <dt>Colour</dt>
                                                            <dd>
                                                                {vehicle.color ||
                                                                    '—'}
                                                            </dd>
                                                        </div>

                                                        <div>
                                                            <dt>Mileage</dt>
                                                            <dd>
                                                                {vehicle.mileageKm.toLocaleString()}
                                                                {' km'}
                                                            </dd>
                                                        </div>
                                                    </dl>

                                                    <dl
                                                        className={
                                                            styles.vehiclePricing
                                                        }
                                                    >
                                                        <div>
                                                            <dt>
                                                                Daily rate
                                                            </dt>
                                                            <dd>
                                                                {formatAmount(
                                                                    vehicle.dailyPrice,
                                                                )}
                                                            </dd>
                                                        </div>

                                                        <div>
                                                            <dt>
                                                                Vehicle value
                                                            </dt>
                                                            <dd>
                                                                {formatAmount(
                                                                    vehicle.vehicleValue,
                                                                )}
                                                            </dd>
                                                        </div>

                                                        <div>
                                                            <dt>Deposit</dt>
                                                            <dd>
                                                                {formatAmount(
                                                                    vehicle.securityDeposit,
                                                                )}
                                                            </dd>
                                                        </div>
                                                    </dl>
                                                </div>
                                            </article>
                                        );
                                    })}

                                </div>
                            )}
                        </>
                    )}

                </section>

                {/* ================================================= */}
                {/* PHOTOS DES VÉHICULES                             */}
                {/* ================================================= */}

                <section
                    className={`${tabClass('media')} ${styles.mediaTab}`}
                >

                    <div className={styles.mediaHeader}>
                        <div className={styles.sectionHeader}>
                            <p className={styles.eyebrow}>
                                FLEET GALLERY
                            </p>

                            <h2>
                                Vehicle media
                            </h2>
                        </div>

                        <Link
                            className={styles.studioButton}
                            href="/admin/media"
                        >
                            Open Media studio / 3D
                            <span aria-hidden="true">
                                &#8594;
                            </span>
                        </Link>
                    </div>

                    <p className={styles.photoHint}>
                        Sélectionnez un véhicule dans la collection
                        pour remplacer sa photo de couverture.
                        Photos&nbsp;: JPEG, PNG, WEBP, AVIF ou GIF
                        (8&nbsp;Mo maximum). Les galeries complètes,
                        les vidéos et les modèles 3D se gèrent dans
                        le Media studio.
                    </p>

                    {data.vehicles.length === 0 ? (
                        <div className={styles.fleetEmpty}>
                            <p>
                                No vehicles to illustrate yet.
                            </p>
                        </div>
                    ) : (
                        <div className={styles.mediaStudio}>

                            {/* ---------------------------------- */}
                            {/* COLLECTION DE VÉHICULES            */}
                            {/* ---------------------------------- */}

                            <aside
                                className={styles.mediaCollection}
                                aria-label="Vehicle collection"
                            >
                                <div
                                    className={
                                        styles.mediaCollectionHead
                                    }
                                >
                                    <div
                                        className={
                                            styles.mediaSearchRow
                                        }
                                    >
                                        <div className={styles.field}>
                                            <label htmlFor="media-search">
                                                Search
                                            </label>

                                            <input
                                                id="media-search"
                                                type="search"
                                                placeholder="Brand, model, plate or VIN..."
                                                value={mediaSearch}
                                                onChange={(event) =>
                                                    setMediaSearch(
                                                        event.target.value,
                                                    )
                                                }
                                            />
                                        </div>

                                        <div className={styles.field}>
                                            <label htmlFor="media-scope">
                                                Media
                                            </label>

                                            <select
                                                id="media-scope"
                                                value={mediaScope}
                                                onChange={(event) =>
                                                    setMediaScope(
                                                        event.target.value as
                                                            | 'all'
                                                            | 'with'
                                                            | 'without',
                                                    )
                                                }
                                            >
                                                <option value="all">
                                                    All vehicles
                                                </option>

                                                <option value="with">
                                                    With photo
                                                </option>

                                                <option value="without">
                                                    Without photo
                                                </option>
                                            </select>
                                        </div>
                                    </div>

                                    <div
                                        className={
                                            styles.mediaCollectionMeta
                                        }
                                    >
                                        <span>
                                            Showing{' '}
                                            {filteredMedia.length} of{' '}
                                            {data.vehicles.length}{' '}
                                            vehicles
                                        </span>

                                        {hasMediaFilters && (
                                            <button
                                                type="button"
                                                onClick={resetMediaFilters}
                                            >
                                                Clear filters
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {filteredMedia.length === 0 ? (
                                    <div
                                        className={styles.mediaListEmpty}
                                    >
                                        <p>
                                            No vehicles match your
                                            search.
                                        </p>

                                        <button
                                            type="button"
                                            onClick={resetMediaFilters}
                                        >
                                            Clear filters
                                        </button>
                                    </div>
                                ) : (
                                    <div className={styles.mediaListWrap}>
                                        <ul className={styles.mediaList}>
                                            {filteredMedia.map(
                                                (vehicle) => {
                                                    const brand =
                                                        brandsById.get(
                                                            vehicle.model
                                                                .brandId,
                                                        );

                                                    const brandName =
                                                        brand?.name ??
                                                        'Luxury';

                                                    const photo =
                                                        primaryImageOf(
                                                            vehicle,
                                                        );

                                                    const imageCount =
                                                        imageCountOf(
                                                            vehicle,
                                                        );

                                                    const videoCount =
                                                        videoCountOf(
                                                            vehicle,
                                                        );

                                                    const isSelected =
                                                        selectedMediaVehicle?.id ===
                                                        vehicle.id;

                                                    return (
                                                        <li
                                                            key={
                                                                vehicle.id
                                                            }
                                                        >
                                                            <button
                                                                type="button"
                                                                className={
                                                                    isSelected
                                                                        ? styles.mediaItemActive
                                                                        : styles.mediaItem
                                                                }
                                                                aria-current={
                                                                    isSelected
                                                                        ? 'true'
                                                                        : undefined
                                                                }
                                                                onClick={() =>
                                                                    setSelectedMediaVehicleId(
                                                                        vehicle.id,
                                                                    )
                                                                }
                                                            >
                                                                <span
                                                                    className={
                                                                        styles.mediaItemThumb
                                                                    }
                                                                >
                                                                    {photo ? (
                                                                        <img
                                                                            src={
                                                                                photo.storagePath
                                                                            }
                                                                            alt=""
                                                                            loading="lazy"
                                                                        />
                                                                    ) : (
                                                                        <span
                                                                            className={
                                                                                styles.mediaItemThumbEmpty
                                                                            }
                                                                            aria-hidden="true"
                                                                        >
                                                                            &#9679;
                                                                        </span>
                                                                    )}
                                                                </span>

                                                                <span
                                                                    className={
                                                                        styles.mediaItemBody
                                                                    }
                                                                >
                                                                    <strong>
                                                                        {brandName}
                                                                        {' '}
                                                                        {
                                                                            vehicle
                                                                                .model
                                                                                .name
                                                                        }
                                                                    </strong>

                                                                    <small>
                                                                        {
                                                                            vehicle.manufactureYear
                                                                        }
                                                                        {' · '}
                                                                        {
                                                                            vehicle.licensePlate
                                                                        }
                                                                    </small>
                                                                </span>

                                                                <span
                                                                    className={
                                                                        styles.mediaItemIndicator
                                                                    }
                                                                    title={`${pluralize(imageCount, 'photo')} · ${pluralize(videoCount, 'video')}`}
                                                                >
                                                                    <span
                                                                        className={
                                                                            imageCount >
                                                                            0
                                                                                ? styles.mediaDotOn
                                                                                : styles.mediaDot
                                                                        }
                                                                    />

                                                                    <span
                                                                        className={
                                                                            styles.mediaItemCount
                                                                        }
                                                                    >
                                                                        {
                                                                            imageCount
                                                                        }
                                                                    </span>
                                                                </span>
                                                            </button>
                                                        </li>
                                                    );
                                                },
                                            )}
                                        </ul>
                                    </div>
                                )}
                            </aside>

                            {/* ---------------------------------- */}
                            {/* ATELIER MÉDIA DU VÉHICULE          */}
                            {/* ---------------------------------- */}

                            <div className={styles.mediaWorkspace}>
                                {selectedMediaVehicle === null ? (
                                    <div className={styles.fleetEmpty}>
                                        <p>
                                            Select a vehicle to
                                            manage its media.
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        <header
                                            className={styles.workspaceHead}
                                        >
                                            <div
                                                className={
                                                    styles.workspaceIdentity
                                                }
                                            >
                                                <p
                                                    className={
                                                        styles.workspaceEyebrow
                                                    }
                                                >
                                                    {selectedMediaBrandName}
                                                </p>

                                                <h3
                                                    className={
                                                        styles.workspaceTitle
                                                    }
                                                >
                                                    {selectedMediaModelName}
                                                    <span
                                                        className={
                                                            styles.workspaceYear
                                                        }
                                                    >
                                                        {selectedMediaYear}
                                                    </span>
                                                </h3>

                                                <p
                                                    className={
                                                        styles.workspaceMeta
                                                    }
                                                >
                                                    <span
                                                        className={
                                                            styles.workspacePlate
                                                        }
                                                    >
                                                        {
                                                            selectedMediaVehicle.licensePlate
                                                        }
                                                    </span>

                                                    {selectedMediaColor && (
                                                        <span>
                                                            {
                                                                selectedMediaColor
                                                            }
                                                        </span>
                                                    )}
                                                </p>
                                            </div>

                                            <span
                                                className={
                                                    selectedMediaCover
                                                        ? styles.workspaceStatusOn
                                                        : styles.workspaceStatusOff
                                                }
                                            >
                                                {selectedMediaCover
                                                    ? 'Cover photo'
                                                    : 'No cover photo'}
                                            </span>
                                        </header>

                                        <figure
                                            className={styles.previewStage}
                                        >
                                            {selectedMediaCover ? (
                                                <img
                                                    className={
                                                        styles.previewImage
                                                    }
                                                    src={
                                                        selectedMediaCover.storagePath
                                                    }
                                                    alt={
                                                        selectedMediaCover.altText ??
                                                        `${selectedMediaBrandName} ${selectedMediaModelName}`
                                                    }
                                                />
                                            ) : (
                                                <figcaption
                                                    className={
                                                        styles.previewEmpty
                                                    }
                                                >
                                                    No cover photo yet
                                                </figcaption>
                                            )}
                                        </figure>

                                        <div
                                            className={styles.workspaceChips}
                                        >
                                            <span
                                                className={styles.mediaChip}
                                            >
                                                {pluralize(
                                                    selectedMediaImages.length,
                                                    'photo',
                                                )}
                                            </span>

                                            <span
                                                className={styles.mediaChip}
                                            >
                                                {pluralize(
                                                    selectedMediaVideos.length,
                                                    'video',
                                                )}
                                            </span>
                                        </div>

                                        {selectedMediaGallery.length > 0 && (
                                            <section
                                                className={
                                                    styles.gallerySection
                                                }
                                                aria-label="Gallery"
                                            >
                                                <div
                                                    className={
                                                        styles.galleryHead
                                                    }
                                                >
                                                    <p
                                                        className={
                                                            styles.galleryLabel
                                                        }
                                                    >
                                                        Gallery
                                                    </p>

                                                    <Link
                                                        className={
                                                            styles.galleryLink
                                                        }
                                                        href="/admin/media"
                                                    >
                                                        Manage in Media
                                                        studio →
                                                    </Link>
                                                </div>

                                                <div
                                                    className={
                                                        styles.galleryGrid
                                                    }
                                                >
                                                    {selectedMediaGallery.map(
                                                        (item) => (
                                                            <figure
                                                                key={item.id}
                                                                className={
                                                                    styles.galleryItem
                                                                }
                                                            >
                                                                <img
                                                                    src={
                                                                        item.storagePath
                                                                    }
                                                                    alt={
                                                                        item.altText ??
                                                                        'Vehicle media'
                                                                    }
                                                                    loading="lazy"
                                                                />
                                                            </figure>
                                                        ),
                                                    )}
                                                </div>

                                                <p
                                                    className={
                                                        styles.galleryNote
                                                    }
                                                >
                                                    Additional gallery
                                                    images are managed in
                                                    the Media studio.
                                                </p>
                                            </section>
                                        )}

                                        <section
                                            className={styles.uploadPanel}
                                            aria-label="Replace cover photo"
                                        >
                                            <div
                                                className={styles.uploadHead}
                                            >
                                                <p
                                                    className={
                                                        styles.uploadLabel
                                                    }
                                                >
                                                    Replace cover photo
                                                </p>

                                                <p
                                                    className={
                                                        styles.uploadNote
                                                    }
                                                >
                                                    JPEG, PNG, WEBP,
                                                    AVIF or GIF · 8 MB
                                                    maximum.
                                                </p>
                                            </div>

                                            <input
                                                key={selectedMediaId}
                                                className={
                                                    styles.photoInput
                                                }
                                                type="file"
                                                accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
                                                onChange={(event) => {
                                                    const file =
                                                        event.target
                                                            .files?.[0] ??
                                                        null;

                                                    setImageFiles(
                                                        (previous) => ({
                                                            ...previous,
                                                            [selectedMediaPlate]:
                                                                file,
                                                        }),
                                                    );
                                                }}
                                            />

                                            {selectedMediaFile && (
                                                <span
                                                    className={
                                                        styles.photoFileName
                                                    }
                                                >
                                                    {
                                                        selectedMediaFile.name
                                                    }
                                                </span>
                                            )}

                                            <div
                                                className={
                                                    styles.uploadActions
                                                }
                                            >
                                                <button
                                                    type="button"
                                                    className={
                                                        styles.photoButton
                                                    }
                                                    disabled={
                                                        !selectedMediaFile ||
                                                        selectedMediaUploading ||
                                                        selectedMediaDeleting
                                                    }
                                                    onClick={() =>
                                                        void uploadVehicleMedia(
                                                            selectedMediaPlate,
                                                            'image',
                                                        )
                                                    }
                                                >
                                                    {selectedMediaUploading
                                                        ? 'Uploading…'
                                                        : 'Upload photo'}
                                                </button>

                                                {selectedMediaCover && (
                                                    <button
                                                        type="button"
                                                        className={
                                                            styles.photoButtonSecondary
                                                        }
                                                        disabled={
                                                            selectedMediaUploading ||
                                                            selectedMediaDeleting
                                                        }
                                                        onClick={() =>
                                                            void deleteVehicleMedia(
                                                                selectedMediaPlate,
                                                                'image',
                                                                selectedMediaImages.length,
                                                            )
                                                        }
                                                    >
                                                        {selectedMediaDeleting
                                                            ? 'Removing…'
                                                            : 'Remove photo'}
                                                    </button>
                                                )}
                                            </div>

                                            {(selectedMediaUploading ||
                                                selectedMediaDeleting) && (
                                                <div
                                                    className={
                                                        styles.progress
                                                    }
                                                    role="status"
                                                    aria-live="polite"
                                                >
                                                    <span
                                                        className={
                                                            styles.progressBar
                                                        }
                                                        aria-hidden="true"
                                                    />

                                                    <span
                                                        className={
                                                            styles.progressText
                                                        }
                                                    >
                                                        {selectedMediaUploading
                                                            ? 'Uploading photo…'
                                                            : 'Removing photo…'}
                                                    </span>
                                                </div>
                                            )}
                                        </section>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                </section>

                {/* ================================================= */}
                {/* TAXONOMIE                                        */}
                {/* ================================================= */}

                <section className={tabClass('forms')}>

                    <div className={styles.sectionHeader}>
                        <p className={styles.eyebrow}>
                            COLLECTION STRUCTURE
                        </p>

                        <h2>
                            Marques & models
                        </h2>
                    </div>

                    <div className={styles.threeColumns}>

                        {/* MARQUE */}

                        <form
                            className={styles.formCard}
                            onSubmit={submitBrand}
                        >
                            <span className={styles.number}>
                                01
                            </span>

                            <h3>New brand</h3>

                            <div className={styles.field}>
                                <label htmlFor="brand-name">
                                    Brand name
                                </label>

                                <input
                                    id="brand-name"
                                    type="text"
                                    placeholder="Bentley"
                                    value={brandName}
                                    minLength={2}
                                    maxLength={100}
                                    onChange={(event) =>
                                        setBrandName(
                                            event.target.value,
                                        )
                                    }
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={actionLoading}
                            >
                                Add brand
                            </button>
                        </form>

                        {/* CATÉGORIE */}

                        <form
                            className={styles.formCard}
                            onSubmit={submitCategory}
                        >
                            <span className={styles.number}>
                                02
                            </span>

                            <h3>New category</h3>

                            <div className={styles.field}>
                                <label htmlFor="category-name">
                                    Category name
                                </label>

                                <input
                                    id="category-name"
                                    type="text"
                                    placeholder="Grand Touring"
                                    value={categoryName}
                                    onChange={(event) =>
                                        setCategoryName(
                                            event.target.value,
                                        )
                                    }
                                />
                            </div>

                            <div className={styles.field}>
                                <label htmlFor="category-description">
                                    Description
                                </label>

                                <textarea
                                    id="category-description"
                                    placeholder="Optional description"
                                    value={categoryDescription}
                                    maxLength={500}
                                    onChange={(event) =>
                                        setCategoryDescription(
                                            event.target.value,
                                        )
                                    }
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={actionLoading}
                            >
                                Add category
                            </button>
                        </form>

                        {/* MODÈLE */}

                        <form
                            className={styles.formCard}
                            onSubmit={submitModel}
                        >
                            <span className={styles.number}>
                                03
                            </span>

                            <h3>New model</h3>

                            <div className={styles.field}>
                                <label htmlFor="model-brand">
                                    Brand
                                </label>

                                <select
                                    id="model-brand"
                                    value={modelBrandName}
                                    onChange={(event) =>
                                        setModelBrandName(
                                            event.target.value,
                                        )
                                    }
                                >
                                    <option value="">
                                        Select brand
                                    </option>

                                    {data.brands.map((brand) => (
                                        <option
                                            key={brand.id}
                                            value={brand.name}
                                        >
                                            {brand.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className={styles.field}>
                                <label htmlFor="model-category">
                                    Category
                                </label>

                                <select
                                    id="model-category"
                                    value={modelCategoryName}
                                    onChange={(event) =>
                                        setModelCategoryName(
                                            event.target.value,
                                        )
                                    }
                                >
                                    <option value="">
                                        Select category
                                    </option>

                                    {data.categories.map(
                                        (category) => (
                                            <option
                                                key={category.id}
                                                value={category.name}
                                            >
                                                {category.name}
                                            </option>
                                        ),
                                    )}
                                </select>
                            </div>

                            <div className={styles.field}>
                                <label htmlFor="model-name">
                                    Model name
                                </label>

                                <input
                                    id="model-name"
                                    type="text"
                                    placeholder="Continental GT"
                                    value={modelName}
                                    onChange={(event) =>
                                        setModelName(
                                            event.target.value,
                                        )
                                    }
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={actionLoading}
                            >
                                Add model
                            </button>
                        </form>

                    </div>

                    {/* ============================================= */}
                    {/* SUPPRESSION : MARQUES / CATÉGORIES / MODÈLES  */}
                    {/* ============================================= */}

                    <div className={styles.catalogIntro}>
                        <p className={styles.eyebrow}>
                            MANAGE COLLECTION
                        </p>

                        <h3>
                            Delete a brand, category or model
                        </h3>

                        <p className={styles.catalogHint}>
                            Entries used by the fleet can still be
                            deleted — the related models and
                            vehicles go with them. Only vehicles
                            that hold reservations or reviews stay
                            protected, to preserve rental history.
                        </p>
                    </div>

                    <div className={styles.catalogPanel}>

                        {/* MARQUES */}

                        <div className={styles.catalogCard}>
                            <CatalogManager
                                title="Brands"
                                emptyMessage="No brand yet."
                                searchPlaceholder="Search brands"
                                rows={brandRows}
                                deletingKey={deletingKey}
                                onDelete={(row) =>
                                    void deleteResource(
                                        'brand',
                                        row.name,
                                        { id: row.id },
                                        {
                                            force: row.cascade,
                                            cascadeSummary:
                                                row.cascadeSummary,
                                        },
                                    )
                                }
                            />
                        </div>

                        {/* CATA%GORIES */}

                        <div className={styles.catalogCard}>
                            <CatalogManager
                                title="Categories"
                                emptyMessage="No category yet."
                                searchPlaceholder="Search categories"
                                rows={categoryRows}
                                deletingKey={deletingKey}
                                onDelete={(row) =>
                                    void deleteResource(
                                        'category',
                                        row.name,
                                        { id: row.id },
                                        {
                                            force: row.cascade,
                                            cascadeSummary:
                                                row.cascadeSummary,
                                        },
                                    )
                                }
                            />
                        </div>

                        {/* MODA^LES */}

                        <div className={styles.catalogCard}>
                            <CatalogManager
                                title="Models"
                                emptyMessage="No model yet."
                                searchPlaceholder="Search models"
                                rows={modelRows}
                                deletingKey={deletingKey}
                                onDelete={(row) =>
                                    void deleteResource(
                                        'model',
                                        row.name,
                                        { id: row.id },
                                        {
                                            force: row.cascade,
                                            cascadeSummary:
                                                row.cascadeSummary,
                                        },
                                    )
                                }
                            />
                        </div>

                    </div>
                </section>

                {/* ================================================= */}
                {/* AJOUT VÉHICULE                                    */}
                {/* ================================================= */}

                <section className={tabClass('forms')}>

                    <div className={styles.sectionHeader}>
                        <p className={styles.eyebrow}>
                            ACQUISITION
                        </p>

                        <h2>
                            Add a vehicle
                        </h2>
                    </div>

                    <form
                        className={styles.vehicleForm}
                        onSubmit={submitVehicle}
                    >

                        <div className={styles.field}>
                            <label htmlFor="vehicle-model">
                                Vehicle model
                            </label>

                            <select
                                id="vehicle-model"
                                value={vehicleModelId}
                                required
                                onChange={(event) =>
                                    setVehicleModelId(
                                        event.target.value,
                                    )
                                }
                            >
                                <option value="">
                                    Select model
                                </option>

                                {data.models.map((model) => {
                                    const brand =
                                        brandsById.get(
                                            model.brandId,
                                        );

                                    return (
                                        <option
                                            key={model.id}
                                            value={model.id}
                                        >
                                            {brand?.name ?? ''}
                                            {' '}
                                            {model.name}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>

                        <div className={styles.field}>
                            <label htmlFor="manufacture-year">
                                Year
                            </label>

                            <input
                                id="manufacture-year"
                                type="number"
                                min="1990"
                                max="2100"
                                required
                                placeholder="Year"
                                value={manufactureYear}
                                onChange={(event) =>
                                    setManufactureYear(
                                        event.target.value,
                                    )
                                }
                            />
                        </div>

                        <div className={styles.field}>
                            <label htmlFor="license-plate">
                                License plate
                            </label>

                            <input
                                id="license-plate"
                                type="text"
                                required
                                placeholder="License plate"
                                value={licensePlate}
                                onChange={(event) =>
                                    setLicensePlate(
                                        event.target.value,
                                    )
                                }
                            />
                        </div>

                        <div className={styles.field}>
                            <label htmlFor="vin">
                                VIN — 17 characters
                            </label>

                            <input
                                id="vin"
                                type="text"
                                required
                                maxLength={17}
                                placeholder="VIN — 17 characters"
                                value={vin}
                                onChange={(event) =>
                                    setVin(event.target.value)
                                }
                            />
                        </div>

                        <div className={styles.field}>
                            <label htmlFor="color">
                                Color
                            </label>

                            <input
                                id="color"
                                type="text"
                                placeholder="Color"
                                value={color}
                                onChange={(event) =>
                                    setColor(event.target.value)
                                }
                            />
                        </div>

                        <div className={styles.field}>
                            <label htmlFor="transmission">
                                Transmission
                            </label>

                            <select
                                id="transmission"
                                value={transmission}
                                onChange={(event) =>
                                    setTransmission(
                                        event.target.value,
                                    )
                                }
                            >
                            <option value="automatic">
                                Automatic
                            </option>

                            <option value="manual">
                                Manual
                            </option>

                            <option value="semi_automatic">
                                Semi automatic
                            </option>
                        </select>
                        </div>

                        <div className={styles.field}>
                            <label htmlFor="fuel-type">
                                Fuel type
                            </label>

                            <select
                                id="fuel-type"
                                value={fuelType}
                                onChange={(event) =>
                                    setFuelType(
                                        event.target.value,
                                    )
                                }
                            >
                            <option value="petrol">
                                Petrol
                            </option>

                            <option value="diesel">
                                Diesel
                            </option>

                            <option value="hybrid">
                                Hybrid
                            </option>

                            <option value="plug_in_hybrid">
                                Plug-in hybrid
                            </option>

                            <option value="electric">
                                Electric
                            </option>
                        </select>
                        </div>

                        <div className={styles.field}>
                            <label htmlFor="seats">
                                Seats
                            </label>

                            <input
                                id="seats"
                                type="number"
                                min="1"
                                max="9"
                                required
                                placeholder="Seats"
                                value={seats}
                                onChange={(event) =>
                                    setSeats(event.target.value)
                                }
                            />
                        </div>

                        <div className={styles.field}>
                            <label htmlFor="power-hp">
                                Power (HP)
                            </label>

                            <input
                                id="power-hp"
                                type="number"
                                min="1"
                                placeholder="Power HP"
                                value={powerHp}
                                onChange={(event) =>
                                    setPowerHp(event.target.value)
                                }
                            />
                        </div>

                        <div className={styles.field}>
                            <label htmlFor="daily-price">
                                Daily price
                            </label>

                            <input
                                id="daily-price"
                                type="number"
                                min="0.01"
                                step="0.01"
                                required
                                placeholder="Daily price"
                                value={dailyPrice}
                                onChange={(event) =>
                                    setDailyPrice(
                                        event.target.value,
                                    )
                                }
                            />
                        </div>

                        <div className={styles.field}>
                            <label htmlFor="security-deposit">
                                Security deposit
                            </label>

                            <input
                                id="security-deposit"
                                type="number"
                                min="0"
                                step="0.01"
                                required
                                placeholder="Security deposit"
                                value={securityDeposit}
                                onChange={(event) =>
                                    setSecurityDeposit(
                                        event.target.value,
                                    )
                                }
                            />
                        </div>

                        <div className={styles.field}>
                            <label htmlFor="vehicle-value">
                                Vehicle value
                            </label>

                            <input
                                id="vehicle-value"
                                type="number"
                                min="0.01"
                                step="0.01"
                                required
                                placeholder="Vehicle value"
                                value={vehicleValue}
                                onChange={(event) =>
                                    setVehicleValue(
                                        event.target.value,
                                    )
                                }
                            />
                        </div>

                        <div className={styles.field}>
                            <label htmlFor="mileage">
                                Mileage (km)
                            </label>

                            <input
                                id="mileage"
                                type="number"
                                min="0"
                                required
                                placeholder="Mileage"
                                value={mileageKm}
                                onChange={(event) =>
                                    setMileageKm(
                                        event.target.value,
                                )
                            }
                        />
                        </div>

                        <div className={`${styles.field} ${styles.fullWidth}`}>
                            <label htmlFor="description">
                                Description
                            </label>

                            <textarea
                                id="description"
                                placeholder="Vehicle description"
                                value={description}
                                onChange={(event) =>
                                    setDescription(
                                        event.target.value,
                                    )
                                }
                            />
                        </div>

                        <div className={styles.field}>
                            <label htmlFor="engine">
                                Engine — e.g. 4.0L V8
                            </label>

                            <input
                                id="engine"
                                type="text"
                                maxLength={120}
                                placeholder="Engine — e.g. 4.0L V8"
                                value={engine}
                                onChange={(event) =>
                                    setEngine(event.target.value)
                                }
                            />
                        </div>

                        <div className={styles.field}>
                            <label htmlFor="torque">
                                Torque (Nm)
                            </label>

                            <input
                                id="torque"
                                type="number"
                                min="1"
                                placeholder="Torque (Nm)"
                                value={torqueNm}
                                onChange={(event) =>
                                    setTorqueNm(event.target.value)
                                }
                            />
                        </div>

                        <div className={styles.field}>
                            <label htmlFor="acceleration">
                                0–100 km/h (s)
                            </label>

                            <input
                                id="acceleration"
                                type="number"
                                min="0.1"
                                step="0.1"
                                placeholder="0–100 km/h (s)"
                                value={acceleration0To100}
                                onChange={(event) =>
                                    setAcceleration(
                                        event.target.value,
                                    )
                                }
                            />
                        </div>

                        <div className={styles.field}>
                            <label htmlFor="top-speed">
                                Top speed (km/h)
                            </label>

                            <input
                                id="top-speed"
                                type="number"
                                min="1"
                                placeholder="Top speed (km/h)"
                                value={topSpeedKmh}
                                onChange={(event) =>
                                    setTopSpeed(event.target.value)
                                }
                            />
                        </div>

                        <div className={styles.field}>
                            <label htmlFor="consumption">
                                Consumption (L/100 km)
                            </label>

                            <input
                                id="consumption"
                                type="number"
                                min="0.1"
                                step="0.1"
                                placeholder="Consumption (L/100 km)"
                                value={consumptionL100km}
                                onChange={(event) =>
                                    setConsumption(
                                        event.target.value,
                                    )
                                }
                            />
                        </div>

                        <div className={styles.field}>
                            <label htmlFor="edition-size">
                                Edition size (units)
                            </label>

                            <input
                                id="edition-size"
                                type="number"
                                min="1"
                                placeholder="Edition size (units)"
                                value={editionSize}
                                disabled={!isLimited}
                                onChange={(event) =>
                                    setEditionSize(
                                        event.target.value,
                                    )
                                }
                            />
                        </div>

                        <label className={styles.checkboxRow}>
                            <input
                                type="checkbox"
                                checked={isSpecial}
                                onChange={(event) => {
                                    setIsSpecial(
                                        event.target.checked,
                                    );

                                    if (event.target.checked) {
                                        setIsLimited(false);
                                        setEditionSize('');
                                    }
                                }}
                            />
                            Special edition
                        </label>

                        <label className={styles.checkboxRow}>
                            <input
                                type="checkbox"
                                checked={isLimited}
                                onChange={(event) => {
                                    setIsLimited(
                                        event.target.checked,
                                    );

                                    if (event.target.checked) {
                                        setIsSpecial(false);
                                    }
                                }}
                            />
                            Limited edition
                        </label>

                        <button
                            type="submit"
                            className={styles.fullWidth}
                            disabled={actionLoading}
                        >
                            {actionLoading
                                ? 'Processing...'
                                : 'Add to collection'}
                        </button>

                    </form>
                </section>

                {/* ================================================= */}
                {/* MODIFICATION                                      */}
                {/* ================================================= */}

                <section className={tabClass('forms')}>

                    <div className={styles.sectionHeader}>
                        <p className={styles.eyebrow}>
                            FLEET CARE
                        </p>

                        <h2>
                            Update vehicle
                        </h2>
                    </div>

                    <form
                        className={styles.editForm}
                        onSubmit={updateVehicle}
                    >

                        <select
                            aria-label="Vehicle to edit"
                            value={editVehicleId}
                            onChange={(event) =>
                                selectVehicleForEdit(
                                    event.target.value,
                                )
                            }
                        >
                            <option value="">
                                Select vehicle
                            </option>

                            {data.vehicles.map((vehicle) => (
                                <option
                                    key={vehicle.id}
                                    value={vehicle.id}
                                >
                                    {vehicle.licensePlate}
                                    {' — '}
                                    {vehicle.model.name}
                                </option>
                            ))}
                        </select>

                        {selectedEditVehicle && (
                            <>
                                <input
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    required
                                    placeholder="Daily price"
                                    value={editDailyPrice}
                                    onChange={(event) =>
                                        setEditDailyPrice(
                                            event.target.value,
                                        )
                                    }
                                />

                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    required
                                    placeholder="Security deposit"
                                    value={editDeposit}
                                    onChange={(event) =>
                                        setEditDeposit(
                                            event.target.value,
                                        )
                                    }
                                />

                                <input
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    required
                                    placeholder="Vehicle value"
                                    value={editValue}
                                    onChange={(event) =>
                                        setEditValue(
                                            event.target.value,
                                        )
                                    }
                                />

                                <input
                                    type="number"
                                    min={
                                        selectedEditVehicle.mileageKm
                                    }
                                    required
                                    placeholder="Mileage"
                                    value={editMileage}
                                    onChange={(event) =>
                                        setEditMileage(
                                            event.target.value,
                                        )
                                    }
                                />

                                <input
                                    type="text"
                                    placeholder="Color"
                                    value={editColor}
                                    onChange={(event) =>
                                        setEditColor(
                                            event.target.value,
                                        )
                                    }
                                />

                                <textarea
                                    className={styles.fullWidth}
                                    placeholder="Description"
                                    value={editDescription}
                                    onChange={(event) =>
                                        setEditDescription(
                                            event.target.value,
                                        )
                                    }
                                />

                                <div className={styles.editStatus}>
                                    <span>Status</span>

                                    <select
                                        aria-label="Vehicle status"
                                        value={editStatus}
                                        onChange={(event) =>
                                            setEditStatus(
                                                event.target.value,
                                            )
                                        }
                                    >
                                        <option value="active">
                                            Active — visible to customers
                                        </option>

                                        <option value="inactive">
                                            Inactive — hidden from customers
                                        </option>

                                        <option value="maintenance">
                                            Maintenance — hidden
                                        </option>

                                        <option value="retired">
                                            Retired — hidden
                                        </option>
                                    </select>
                                </div>

                                <button
                                    type="submit"
                                    className={styles.fullWidth}
                                    disabled={actionLoading}
                                >
                                    Save changes
                                </button>
                            </>
                        )}

                    </form>
                </section>

            </div>

        </main>
    );
}

