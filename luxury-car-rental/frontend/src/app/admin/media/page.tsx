'use client';

import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type FormEvent,
} from 'react';
import Link from 'next/link';

import { useConfirm } from '@/components/confirm-dialog';
import { useToast } from '@/components/toast';

import styles from './media.module.css';

// ==========================================================
// TYPES
// ==========================================================

type MediaKind = 'image' | 'video' | 'model3d';

interface MediaItem {
    id: string;
    storagePath: string;
    mediaType: string;
    isPrimary?: boolean;
}

interface Vehicle {
    id: string;
    licensePlate: string;
    model: { name: string };
    images?: MediaItem[];
}

// Chaque type de média : libellé, rappel de contrainte et
// filtre du sélecteur de fichiers. Les contraintes reprennent
// exactement celles imposées par l'API (aucune n'est affaiblie).
const MEDIA_KINDS: {
    value: MediaKind;
    label: string;
    hint: string;
    accept: string;
}[] = [
    {
        value: 'image',
        label: 'Photograph',
        hint: 'JPEG · PNG · WebP — 8 MB max',
        accept: 'image/jpeg,image/png,image/webp,image/avif,image/gif',
    },
    {
        value: 'video',
        label: 'Test-drive film',
        hint: 'MP4 · WebM · OGG — 300 MB max',
        accept: 'video/mp4,video/webm,video/ogg,video/quicktime',
    },
    {
        value: 'model3d',
        label: 'Interactive 3D',
        hint: 'GLB v2 — 40 MB max',
        accept: '.glb,model/gltf-binary',
    },
];

function humanSize(bytes: number): string {
    if (bytes < 1024) {
        return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
        return `${Math.round(bytes / 1024)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FleetMedia() {
    const confirm = useConfirm();
    const toast = useToast();

    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [plate, setPlate] = useState('');
    const [kind, setKind] = useState<MediaKind>('image');
    const [file, setFile] = useState<File | null>(null);
    const [fileReset, setFileReset] = useState(0);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const previewUrlRef = useRef<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    const refreshFleet = useCallback(async () => {
        try {
            const r = await fetch('/api/admin/vehicles', {
                cache: 'no-store',
            });

            if (!r.ok) {
                throw new Error('Fleet unavailable');
            }

            const data = (await r.json()) as { vehicles: Vehicle[] };
            setVehicles(data.vehicles);
            setPlate(
                (previous) =>
                    previous || data.vehicles?.[0]?.licensePlate || '',
            );
        } catch (e) {
            setError(
                e instanceof Error ? e.message : 'Fleet unavailable',
            );
        }
    }, []);

    useEffect(() => {
        const initialize = async () => {
            await refreshFleet();
        };

        void initialize();
    }, [refreshFleet]);

    // Aperçu local (photo / film) du fichier choisi, avant envoi.
    // L'URL est créée dans les gestionnaires d'événements (jamais
    // dans un effet) puis révoquée pour éviter toute fuite mémoire.
    const setPreview = useCallback(
        (nextFile: File | null, nextKind: MediaKind) => {
            if (previewUrlRef.current) {
                URL.revokeObjectURL(previewUrlRef.current);
                previewUrlRef.current = null;
            }

            if (!nextFile || nextKind === 'model3d') {
                setPreviewUrl(null);

                return;
            }

            const url = URL.createObjectURL(nextFile);
            previewUrlRef.current = url;
            setPreviewUrl(url);
        },
        [],
    );

    useEffect(
        () => () => {
            if (previewUrlRef.current) {
                URL.revokeObjectURL(previewUrlRef.current);
                previewUrlRef.current = null;
            }
        },
        [],
    );

    const selected = vehicles.find((v) => v.licensePlate === plate);
    const assets = selected?.images ?? [];
    const activeKind =
        MEDIA_KINDS.find((k) => k.value === kind) ?? MEDIA_KINDS[0];

    async function upload(e: FormEvent) {
        e.preventDefault();

        if (!file) {
            return;
        }

        setUploading(true);
        setError('');
        setMessage('');

        try {
            const data = new FormData();
            data.append('licensePlate', plate);
            data.append('kind', kind);
            data.append('file', file);

            const r = await fetch('/api/admin/media', {
                method: 'POST',
                body: data,
            });
            const response = await r.json();

            if (!r.ok) {
                throw new Error(
                    Array.isArray(response.message)
                        ? response.message.join(' ')
                        : response.message || 'Upload rejected',
                );
            }

            const done =
                kind === 'model3d'
                    ? 'GLB model attached.'
                    : `Additional ${kind} added to the vehicle gallery.`;

            setMessage(done);
            toast.success(done, 'Vehicle media');
            setFile(null);
            setFileReset((x) => x + 1);
            setPreview(null, kind);
            await refreshFleet();
        } catch (e) {
            const detail =
                e instanceof Error ? e.message : 'Upload failed';

            setError(detail);
            toast.error(detail, 'Vehicle media');
        } finally {
            setUploading(false);
        }
    }

    async function removeMedia(media: MediaItem) {
        const isVideo = media.mediaType === 'video';
        const noun = isVideo ? 'video' : 'photograph';
        const approved = await confirm({
            title: isVideo ? 'Delete video' : 'Delete photo',
            message: `This ${noun} will be permanently removed from the gallery of ${plate}. This action cannot be undone.`,
            confirmLabel: isVideo ? 'Delete video' : 'Delete photo',
            tone: 'danger',
        });

        if (!approved) {
            return;
        }

        setDeletingId(media.id);
        setError('');
        setMessage('');

        try {
            const r = await fetch(
                `/api/admin/media/${encodeURIComponent(media.id)}`,
                { method: 'DELETE' },
            );

            if (r.status === 401) {
                setError('Authentication required. Please sign in again.');

                return;
            }

            if (r.status === 403) {
                setError('Administrator access required.');

                return;
            }

            const response = (await r
                .json()
                .catch(() => ({}))) as {
                message?: string | string[];
            };

            if (!r.ok) {
                throw new Error(
                    Array.isArray(response.message)
                        ? response.message.join(' ')
                        : response.message || 'Deletion rejected',
                );
            }

            const removed = `${isVideo ? 'Video' : 'Photo'} removed from the collection.`;

            setMessage(removed);
            toast.success(removed, 'Vehicle media');
            await refreshFleet();
        } catch (e) {
            const detail =
                e instanceof Error
                    ? e.message
                    : 'Unable to delete media.';

            setError(detail);
            toast.error(detail, 'Vehicle media');
        } finally {
            setDeletingId(null);
        }
    }

    const chosenFileMeta = file
        ? `${file.name} · ${humanSize(file.size)}`
        : '';

    return (
        <main className={styles.page}>
            <header className={styles.hero}>
                <div className={styles.heroText}>
                    <p className={styles.eyebrow}>
                        Administration · Vehicle studio
                    </p>

                    <h1 className={styles.title}>
                        Vehicle media studio
                    </h1>

                    <p className={styles.intro}>
                        Add additional vehicle photographs and
                        test-drive films without replacing the primary
                        image. Upload a real GLB file to activate the
                        interactive showroom. Remove any photograph or
                        video with the bin icon.
                    </p>
                </div>

                <div className={styles.heroMetric}>
                    <strong>
                        {String(assets.length).padStart(2, '0')}
                    </strong>
                    <span>Assets in gallery</span>
                </div>
            </header>

            {error && (
                <p role="alert" className={styles.error}>
                    {error}
                </p>
            )}

            {message && (
                <p role="status" className={styles.success}>
                    {message}
                </p>
            )}

            <div className={styles.console}>
                <form className={styles.card} onSubmit={upload}>
                    <header className={styles.cardHead}>
                        <span className={styles.step}>01</span>
                        <h2 className={styles.cardTitle}>Add media</h2>
                    </header>

                    <div className={styles.field}>
                        <label
                            htmlFor="media-vehicle"
                            className={styles.fieldLabel}
                        >
                            Vehicle
                        </label>

                        <select
                            id="media-vehicle"
                            required
                            value={plate}
                            onChange={(e) => setPlate(e.target.value)}
                        >
                            {vehicles.map((v) => (
                                <option
                                    key={v.id}
                                    value={v.licensePlate}
                                >
                                    {v.licensePlate} · {v.model?.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className={styles.field}>
                        <span
                            id="media-kind-label"
                            className={styles.fieldLabel}
                        >
                            Media type
                        </span>

                        <div
                            className={styles.kindGrid}
                            role="group"
                            aria-labelledby="media-kind-label"
                        >
                            {MEDIA_KINDS.map((k) => (
                                <button
                                    key={k.value}
                                    type="button"
                                    className={
                                        kind === k.value
                                            ? styles.kindActive
                                            : styles.kind
                                    }
                                    aria-pressed={kind === k.value}
                                    onClick={() => {
                                        setKind(k.value);
                                        setFile(null);
                                        setPreview(null, k.value);
                                    }}
                                >
                                    <span className={styles.kindLabel}>
                                        {k.label}
                                    </span>
                                    <span className={styles.kindHint}>
                                        {k.hint}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className={styles.field}>
                        <label
                            htmlFor="media-file"
                            className={styles.fieldLabel}
                        >
                            Choose a file
                        </label>

                        <input
                            id="media-file"
                            key={`${kind}-${fileReset}`}
                            className={styles.fileInput}
                            required
                            type="file"
                            accept={activeKind.accept}
                            onChange={(e) => {
                                const next =
                                    e.target.files?.[0] ?? null;
                                setFile(next);
                                setPreview(next, kind);
                            }}
                        />

                        {chosenFileMeta && (
                            <p className={styles.fileMeta}>
                                {chosenFileMeta}
                            </p>
                        )}
                    </div>

                    {file && (
                        <div className={styles.previewBox}>
                            {kind === 'model3d' ? (
                                <div className={styles.modelPreview}>
                                    <span className={styles.modelBadge}>
                                        GLB
                                    </span>
                                    <span className={styles.modelText}>
                                        Interactive 3D model
                                    </span>
                                </div>
                            ) : previewUrl && kind === 'video' ? (
                                <video
                                    src={previewUrl}
                                    muted
                                    playsInline
                                    controls
                                />
                            ) : previewUrl ? (
                                <img
                                    src={previewUrl}
                                    alt="Selected media preview"
                                />
                            ) : null}
                        </div>
                    )}

                    <button
                        className={styles.submit}
                        disabled={uploading || !file || !plate}
                    >
                        {uploading ? 'Uploading…' : 'Upload media →'}
                    </button>

                    <p className={styles.hint}>
                        Max size:{' '}
                        {kind === 'image'
                            ? '8 MB'
                            : kind === 'video'
                              ? '300 MB'
                              : '40 MB'}
                        . The original 3D file must represent the real
                        vehicle; no model is generated automatically.
                    </p>
                </form>

                <section
                    className={styles.card}
                    aria-label="Current collection"
                >
                    <header className={styles.cardHead}>
                        <span className={styles.step}>02</span>
                        <h2 className={styles.cardTitle}>
                            Current collection
                        </h2>
                        <span className={styles.countChip}>
                            {assets.length}
                        </span>
                    </header>

                    {selected ? (
                        <>
                            <p className={styles.panelLead}>
                                {selected.licensePlate} ·{' '}
                                {selected.model?.name}
                            </p>

                            <p className={styles.panelNote}>
                                {assets.length} photo/video assets
                                associated in the database. Use the bin
                                icon to remove one.
                                {assets.length > 8
                                    ? ' Showing the first 8.'
                                    : ''}
                            </p>

                            {assets.length === 0 ? (
                                <p className={styles.empty}>
                                    No media yet for this vehicle.
                                </p>
                            ) : (
                                <div className={styles.gallery}>
                                    {assets.slice(0, 8).map((m) => {
                                        const isVideo =
                                            m.mediaType === 'video';
                                        const label = isVideo
                                            ? 'Delete video'
                                            : 'Delete photo';

                                        return (
                                            <figure
                                                key={m.id}
                                                className={styles.asset}
                                            >
                                                {isVideo ? (
                                                    <>
                                                        <video
                                                            className={
                                                                styles.assetMedia
                                                            }
                                                            src={
                                                                m.storagePath
                                                            }
                                                            muted
                                                            playsInline
                                                            preload="metadata"
                                                        />
                                                        <span
                                                            className={
                                                                styles.assetPlay
                                                            }
                                                            aria-hidden="true"
                                                        >
                                                            ▶
                                                        </span>
                                                    </>
                                                ) : (
                                                    <img
                                                        className={
                                                            styles.assetMedia
                                                        }
                                                        src={m.storagePath}
                                                        alt="Vehicle media"
                                                    />
                                                )}

                                                {isVideo && (
                                                    <span
                                                        className={
                                                            styles.assetBadge
                                                        }
                                                    >
                                                        VIDEO
                                                    </span>
                                                )}

                                                {m.isPrimary && (
                                                    <span
                                                        className={
                                                            styles.primaryBadge
                                                        }
                                                    >
                                                        PRIMARY
                                                    </span>
                                                )}

                                                <button
                                                    type="button"
                                                    className={
                                                        styles.assetDelete
                                                    }
                                                    disabled={
                                                        deletingId === m.id
                                                    }
                                                    onClick={() =>
                                                        void removeMedia(m)
                                                    }
                                                    aria-label={label}
                                                    title={label}
                                                >
                                                    {deletingId === m.id
                                                        ? '…'
                                                        : (
                                                            <svg
                                                                viewBox="0 0 24 24"
                                                                width="13"
                                                                height="13"
                                                                aria-hidden="true"
                                                                focusable="false"
                                                            >
                                                                <path
                                                                    d="M4 7h16M9 7V5h6v2m-8 0 1 13h8l1-13"
                                                                    fill="none"
                                                                    stroke="currentColor"
                                                                    strokeWidth="2"
                                                                    strokeLinecap="round"
                                                                    strokeLinejoin="round"
                                                                />
                                                            </svg>
                                                        )}
                                                </button>
                                            </figure>
                                        );
                                    })}
                                </div>
                            )}

                            <Link
                                className={styles.panelLink}
                                href={`/vehicles/${encodeURIComponent(selected.id)}`}
                            >
                                View public presentation →
                            </Link>
                        </>
                    ) : (
                        <p className={styles.empty}>
                            Select a vehicle to see its media
                            collection.
                        </p>
                    )}
                </section>
            </div>
        </main>
    );
}
