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

// ==========================================================
// PAGE ADMIN VEHICLES
// ==========================================================

export default function AdminVehiclesPage() {
    const router = useRouter();

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
    const [editMileage, setEditMileage] = useState('');
    const [editColor, setEditColor] = useState('');
    const [editDescription, setEditDescription] =
        useState('');

    // ========================================================
    // FILTRES DE LA FLOTTE
    // ========================================================

    const [fleetSearch, setFleetSearch] = useState('');
    const [fleetBrand, setFleetBrand] = useState('all');
    const [fleetCategory, setFleetCategory] = useState('all');
    const [fleetStatus, setFleetStatus] = useState('all');

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

            await loadData();
        } catch (caught) {
            setError(
                caught instanceof Error
                    ? caught.message
                    : 'Operation failed.',
            );
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
        setEditMileage(
            String(vehicle.mileageKm),
        );
        setEditColor(vehicle.color ?? '');
        setEditDescription(
            vehicle.description ?? '',
        );
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

                            mileageKm:
                                Number(editMileage),

                            color:
                                editColor.trim(),

                            description:
                                editDescription.trim(),
                        },
                    }),
                },
            );

            if (!response.ok) {
                throw new Error(await readError(response));
            }

            setSuccess(
                `${selectedEditVehicle.licensePlate} updated successfully.`,
            );

            await loadData();
        } catch (caught) {
            setError(
                caught instanceof Error
                    ? caught.message
                    : 'Unable to update vehicle.',
            );
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

            setSuccess(
                kind === 'video'
                    ? `Video updated for ${plate}.`
                    : `Photo updated for ${plate}.`,
            );

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
            setError(
                caught instanceof Error
                    ? caught.message
                    : 'Unable to upload file.',
            );
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
    ) {
        const label = kind === 'video' ? 'video' : 'photo';

        if (
            !window.confirm(
                `Delete the ${label} of ${plate}?`,
            )
        ) {
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

            setSuccess(
                kind === 'video'
                    ? `Video removed for ${plate}.`
                    : `Photo removed for ${plate}.`,
            );

            await loadData();
        } catch (caught) {
            setError(
                caught instanceof Error
                    ? caught.message
                    : 'Unable to delete file.',
            );
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
                            Fleet <em>atelier.</em>
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

                                        return (
                                            <article
                                                key={vehicle.id}
                                                className={styles.vehicleCard}
                                            >

                                                <div className={styles.vehicleTop}>
                                                    <span>
                                                        {vehicle.status}
                                                    </span>

                                                    <small>
                                                        {vehicle.manufactureYear}
                                                    </small>
                                                </div>

                                                <h3>
                                                    {brand?.name ??
                                                        'Luxury'}{' '}
                                                    {vehicle.model.name}
                                                </h3>

                                                <p className={styles.category}>
                                                    {category?.name ??
                                                        'Premium'}
                                                </p>

                                                <div className={styles.vehicleDetails}>
                                                    <div>
                                                        <span>Color</span>
                                                        <strong>
                                                            {vehicle.color ||
                                                                '—'}
                                                        </strong>
                                                    </div>

                                                    <div>
                                                        <span>Year</span>
                                                        <strong>
                                                            {vehicle.manufactureYear}
                                                        </strong>
                                                    </div>

                                                    <div>
                                                        <span>Transmission</span>
                                                        <strong>
                                                            {vehicle.transmission}
                                                        </strong>
                                                    </div>

                                                    <div>
                                                        <span>Fuel</span>
                                                        <strong>
                                                            {vehicle.fuelType}
                                                        </strong>
                                                    </div>

                                                    <div>
                                                        <span>Seats</span>
                                                        <strong>
                                                            {vehicle.seats}
                                                        </strong>
                                                    </div>

                                                    <div>
                                                        <span>Power</span>
                                                        <strong>
                                                            {vehicle.powerHp
                                                                ? `${vehicle.powerHp} hp`
                                                                : '—'}
                                                        </strong>
                                                    </div>

                                                    <div>
                                                        <span>Configuration</span>
                                                        <strong>
                                                            {vehicle.transmission}
                                                            {' / '}
                                                            {vehicle.fuelType}
                                                        </strong>
                                                    </div>

                                                    <div>
                                                        <span>Plate</span>
                                                        <strong>
                                                            {vehicle.licensePlate}
                                                        </strong>
                                                    </div>

                                                    <div>
                                                        <span>VIN</span>
                                                        <strong>
                                                            {vehicle.vin}
                                                        </strong>
                                                    </div>

                                                    <div>
                                                        <span>Mileage</span>
                                                        <strong>
                                                            {vehicle.mileageKm.toLocaleString()}
                                                            {' '}km
                                                        </strong>
                                                    </div>
                                                </div>

                                                <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid var(--line)' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', minHeight: '42px' }}>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                            <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--muted-text)', minHeight: '14px' }}>Daily rate</span>
                                                            <strong style={{ fontSize: '18px', fontWeight: 700, color: 'var(--gold-text)', lineHeight: '1.2' }}>{formatAmount(vehicle.dailyPrice)}</strong>
                                                        </div>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
                                                            <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--muted-text)', minHeight: '14px' }}>Security deposit</span>
                                                            <strong style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)', lineHeight: '1.2' }}>{formatAmount(vehicle.securityDeposit)}</strong>
                                                        </div>
                                                    </div>
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

                <section className={tabClass('media')}>

                    <div className={styles.sectionHeader}>
                        <p className={styles.eyebrow}>
                            FLEET GALLERY
                        </p>

                        <h2>
                            Vehicle media
                        </h2>
                    </div>

                    <p className={styles.photoHint}>
                        Associez une photo et/ou une vidéo à
                        chaque voiture. Sélectionnez un fichier
                        depuis votre ordinateur, puis cliquez sur
                        « Upload ». Photos&nbsp;: JPEG, PNG, WEBP,
                        AVIF, GIF (8&nbsp;Mo maximum). Vidéos&nbsp;:
                        MP4, WEBM, OGG ou MOV (80&nbsp;Mo maximum).
                    </p>

                    {data.vehicles.length === 0 ? (
                        <div className={styles.fleetEmpty}>
                            <p>
                                No vehicles to illustrate yet.
                            </p>
                        </div>
                    ) : (
                        <div className={styles.photoTableWrap}>
                            <table className={styles.photoTable}>
                                <thead>
                                    <tr>
                                        <th>Vehicle</th>
                                        <th>Plate</th>
                                        <th>Photo</th>
                                        <th>Video</th>
                                        <th>Upload media</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {data.vehicles.map(
                                        (vehicle) => {
                                            const brand =
                                                brandsById.get(
                                                    vehicle.model.brandId,
                                                );

                                            const brandName =
                                                brand?.name ??
                                                'Luxury';

                                            const media =
                                                vehicle.images ?? [];

                                            const primaryImage =
                                                media.find(
                                                    (item) =>
                                                        item.mediaType ===
                                                            'image' &&
                                                        item.isPrimary,
                                                ) ??
                                                media.find(
                                                    (item) =>
                                                        item.mediaType ===
                                                        'image',
                                                );

                                            const primaryVideo =
                                                media.find(
                                                    (item) =>
                                                        item.mediaType ===
                                                            'video' &&
                                                        item.isPrimary,
                                                ) ??
                                                media.find(
                                                    (item) =>
                                                        item.mediaType ===
                                                        'video',
                                                );

                                            const imageFile =
                                                imageFiles[
                                                    vehicle.licensePlate
                                                ] ?? null;

                                            const videoFile =
                                                videoFiles[
                                                    vehicle.licensePlate
                                                ] ?? null;

                                            const uploadingImage =
                                                uploadingKey ===
                                                `${vehicle.licensePlate}:image`;

                                            const uploadingVideo =
                                                uploadingKey ===
                                                `${vehicle.licensePlate}:video`;

                                            const deletingImage =
                                                deletingKey ===
                                                `${vehicle.licensePlate}:image`;

                                            const deletingVideo =
                                                deletingKey ===
                                                `${vehicle.licensePlate}:video`;

                                            return (
                                                <tr key={vehicle.id}>
                                                    <td
                                                        className={
                                                            styles.photoIdentity
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

                                                        <span>
                                                            {
                                                                vehicle.manufactureYear
                                                            }
                                                        </span>
                                                    </td>

                                                    <td
                                                        className={
                                                            styles.photoPlate
                                                        }
                                                    >
                                                        {
                                                            vehicle.licensePlate
                                                        }
                                                    </td>

                                                    <td>
                                                        {primaryImage ? (
                                                            <div
                                                                className={
                                                                    styles.mediaPreview
                                                                }
                                                            >
                                                                <img
                                                                    className={
                                                                        styles.photoThumb
                                                                    }
                                                                    src={
                                                                        primaryImage.storagePath
                                                                    }
                                                                    alt={
                                                                        primaryImage.altText ??
                                                                        `${brandName} ${vehicle.model.name}`
                                                                    }
                                                                    loading="lazy"
                                                                />

                                                                <button
                                                                    type="button"
                                                                    className={
                                                                        styles.photoRemove
                                                                    }
                                                                    disabled={
                                                                        deletingImage
                                                                    }
                                                                    onClick={() =>
                                                                        void deleteVehicleMedia(
                                                                            vehicle.licensePlate,
                                                                            'image',
                                                                        )
                                                                    }
                                                                >
                                                                    {deletingImage
                                                                        ? 'Removing…'
                                                                        : 'Remove'}
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <span
                                                                className={
                                                                    styles.photoEmpty
                                                                }
                                                            >
                                                                No photo
                                                            </span>
                                                        )}
                                                    </td>

                                                    <td>
                                                        {primaryVideo ? (
                                                            <div
                                                                className={
                                                                    styles.mediaPreview
                                                                }
                                                            >
                                                                <video
                                                                    className={
                                                                        styles.photoThumb
                                                                    }
                                                                    src={
                                                                        primaryVideo.storagePath
                                                                    }
                                                                    poster={
                                                                        primaryImage?.storagePath ??
                                                                        undefined
                                                                    }
                                                                    muted
                                                                    playsInline
                                                                    preload="metadata"
                                                                />

                                                                <button
                                                                    type="button"
                                                                    className={
                                                                        styles.photoRemove
                                                                    }
                                                                    disabled={
                                                                        deletingVideo
                                                                    }
                                                                    onClick={() =>
                                                                        void deleteVehicleMedia(
                                                                            vehicle.licensePlate,
                                                                            'video',
                                                                        )
                                                                    }
                                                                >
                                                                    {deletingVideo
                                                                        ? 'Removing…'
                                                                        : 'Remove'}
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <span
                                                                className={
                                                                    styles.photoEmpty
                                                                }
                                                            >
                                                                No video
                                                            </span>
                                                        )}
                                                    </td>

                                                    <td>
                                                        <div
                                                            className={
                                                                styles.mediaStack
                                                            }
                                                        >
                                                            <div
                                                                className={
                                                                    styles.mediaField
                                                                }
                                                            >
                                                                <span
                                                                    className={
                                                                        styles.mediaLabel
                                                                    }
                                                                >
                                                                    Photo
                                                                </span>

                                                                <input
                                                                    className={
                                                                        styles.photoInput
                                                                    }
                                                                    type="file"
                                                                    accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
                                                                    onChange={(
                                                                        event,
                                                                    ) => {
                                                                        const file =
                                                                            event
                                                                                .target
                                                                                .files?.[0] ??
                                                                            null;

                                                                        setImageFiles(
                                                                            (
                                                                                previous,
                                                                            ) => ({
                                                                                ...previous,
                                                                                [vehicle.licensePlate]:
                                                                                    file,
                                                                            }),
                                                                        );
                                                                    }}
                                                                />

                                                                {imageFile && (
                                                                    <span
                                                                        className={
                                                                            styles.photoFileName
                                                                        }
                                                                    >
                                                                        {
                                                                            imageFile.name
                                                                        }
                                                                    </span>
                                                                )}

                                                                <button
                                                                    type="button"
                                                                    className={
                                                                        styles.photoButton
                                                                    }
                                                                    disabled={
                                                                        !imageFile ||
                                                                        uploadingImage ||
                                                                        deletingImage
                                                                    }
                                                                    onClick={() =>
                                                                        void uploadVehicleMedia(
                                                                            vehicle.licensePlate,
                                                                            'image',
                                                                        )
                                                                    }
                                                                >
                                                                    {uploadingImage
                                                                        ? 'Uploading…'
                                                                        : 'Upload photo'}
                                                                </button>
                                                            </div>

                                                            <div
                                                                className={
                                                                    styles.mediaField
                                                                }
                                                            >
                                                                <span
                                                                    className={
                                                                        styles.mediaLabel
                                                                    }
                                                                >
                                                                    Video
                                                                </span>

                                                                <input
                                                                    className={
                                                                        styles.photoInput
                                                                    }
                                                                    type="file"
                                                                    accept="video/mp4,video/webm,video/ogg,video/quicktime"
                                                                    onChange={(
                                                                        event,
                                                                    ) => {
                                                                        const file =
                                                                            event
                                                                                .target
                                                                                .files?.[0] ??
                                                                            null;

                                                                        setVideoFiles(
                                                                            (
                                                                                previous,
                                                                            ) => ({
                                                                                ...previous,
                                                                                [vehicle.licensePlate]:
                                                                                    file,
                                                                            }),
                                                                        );
                                                                    }}
                                                                />

                                                                {videoFile && (
                                                                    <span
                                                                        className={
                                                                            styles.photoFileName
                                                                        }
                                                                    >
                                                                        {
                                                                            videoFile.name
                                                                        }
                                                                    </span>
                                                                )}

                                                                <button
                                                                    type="button"
                                                                    className={
                                                                        styles.photoButtonSecondary
                                                                    }
                                                                    disabled={
                                                                        !videoFile ||
                                                                        uploadingVideo ||
                                                                        deletingVideo
                                                                    }
                                                                    onClick={() =>
                                                                        void uploadVehicleMedia(
                                                                            vehicle.licensePlate,
                                                                            'video',
                                                                        )
                                                                    }
                                                                >
                                                                    {uploadingVideo
                                                                        ? 'Uploading…'
                                                                        : 'Upload video'}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        },
                                    )}
                                </tbody>
                            </table>
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

