
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { useToast } from '@/components/toast';
import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';

import styles from './profile.module.css';

// ==========================================================
// TYPE DU PROFIL CLIENT
// ==========================================================

interface CustomerProfile {
    id?: string;
    dateOfBirth?: string;
    addressLine?: string;
    city?: string;
    postalCode?: string;
    country?: string;

    licenseNumber?: string;
    licenseCountry?: string;
    licenseIssuedOn?: string;
    licenseExpiresOn?: string;
}

// ==========================================================
// TYPE DES DONNÉES DU FORMULAIRE
// ==========================================================

interface ProfileForm {
    dateOfBirth: string;
    addressLine: string;
    city: string;
    postalCode: string;
    country: string;

    licenseNumber: string;
    licenseCountry: string;
    licenseIssuedOn: string;
    licenseExpiresOn: string;
}

// Valeurs initiales du formulaire.
const initialForm: ProfileForm = {
    dateOfBirth: '',
    addressLine: '',
    city: '',
    postalCode: '',
    country: '',

    licenseNumber: '',
    licenseCountry: '',
    licenseIssuedOn: '',
    licenseExpiresOn: '',
};

// ==========================================================
// TYPE DES ERREURS API
// ==========================================================

interface ApiError {
    message?: string | string[];
}

// ==========================================================
// LIRE UN MESSAGE D'ERREUR NESTJS
// ==========================================================

async function readApiError(response: Response): Promise<string> {
    try {
        const data: ApiError = await response.json();

        if (Array.isArray(data.message)) {
            return data.message.join(' ');
        }

        if (typeof data.message === 'string') {
            return data.message;
        }
    } catch {
        // Si la réponse n'est pas du JSON,
        // conserver un message générique.
    }

    return `Request failed with status ${response.status}.`;
}

// ==========================================================
// PAGE DU PROFIL CLIENT
// ==========================================================

export default function CustomerProfilePage() {
    const router = useRouter();
    const toast = useToast();

    // Profil déjà enregistré en base.
    const [profile, setProfile] =
        useState<CustomerProfile | null>(null);

    // Indique l'état de la page.
    const [mode, setMode] =
        useState<'loading' | 'create' | 'view' | 'error'>('loading');

    // Contenu du formulaire.
    const [form, setForm] =
        useState<ProfileForm>(initialForm);

    // États de sauvegarde.
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Indique si le profil existant est en cours
    // de modification (mode édition).
    const [editing, setEditing] = useState(false);

    // ========================================================
    // CHARGER LE PROFIL EXISTANT
    // ========================================================

    useEffect(() => {
        let active = true;

        async function loadProfile() {
            try {
                const response = await fetch('/api/customer-profile', {
                    method: 'GET',
                    cache: 'no-store',
                });

                // JWT expiré ou utilisateur non connecté.
                if (response.status === 401) {
                    router.replace('/login');
                    return;
                }

                // 404 signifie que le profil client n'existe pas.
                // Dans ce cas, on affiche le formulaire de création.
                if (response.status === 404) {
                    if (active) {
                        setMode('create');
                    }
                    return;
                }

                // Gérer les autres erreurs backend.
                if (!response.ok) {
                    throw new Error(await readApiError(response));
                }

                const data: CustomerProfile = await response.json();

                if (active) {
                    setProfile(data);
                    setMode('view');
                }
            } catch {
                if (active) {
                    setError('Unable to retrieve your customer profile.');
                    setMode('error');
                }
            }
        }

        void loadProfile();

        return () => {
            active = false;
        };
    }, [router]);

    // ========================================================
    // MODIFIER UN CHAMP DU FORMULAIRE
    // ========================================================

    function updateField(
        field: keyof ProfileForm,
        value: string,
    ) {
        setForm((previous) => ({
            ...previous,
            [field]: value,
        }));
    }

    // ========================================================
    // PRÉREMPLIR LE FORMULAIRE AVEC LE PROFIL ENREGISTRÉ
    // ========================================================

    function fillFormFromProfile(source: CustomerProfile) {
        setForm({
            dateOfBirth: source.dateOfBirth?.slice(0, 10) ?? '',
            addressLine: source.addressLine ?? '',
            city: source.city ?? '',
            postalCode: source.postalCode ?? '',
            country: source.country ?? '',

            licenseNumber: source.licenseNumber ?? '',
            licenseCountry: source.licenseCountry ?? '',
            licenseIssuedOn: source.licenseIssuedOn?.slice(0, 10) ?? '',
            licenseExpiresOn: source.licenseExpiresOn?.slice(0, 10) ?? '',
        });
    }

    // ========================================================
    // ACTIVER / ANNULER LA MODIFICATION
    // ========================================================

    function startEditing() {
        if (!profile) {
            return;
        }

        fillFormFromProfile(profile);
        setError('');
        setSuccess('');
        setEditing(true);
    }

    function cancelEditing() {
        setEditing(false);
        setError('');
        setSuccess('');
    }

    // ========================================================
    // CRÉER LE PROFIL CLIENT
    // ========================================================

    async function handleSubmit(
        event: FormEvent<HTMLFormElement>,
    ) {
        event.preventDefault();

        setError('');
        setSuccess('');
        setSubmitting(true);

        // Un profil existant est modifié (PATCH),
        // sinon il est créé (POST).
        const isUpdate = profile !== null;

        try {
            // Préparer les informations du client.
            // Les codes pays doivent être en majuscules.
            const payload: ProfileForm = {
                dateOfBirth: form.dateOfBirth,
                addressLine: form.addressLine.trim(),
                city: form.city.trim(),
                postalCode: form.postalCode.trim(),
                country: form.country.trim().toUpperCase(),

                licenseNumber: form.licenseNumber.trim(),
                licenseCountry: form.licenseCountry.trim().toUpperCase(),
                licenseIssuedOn: form.licenseIssuedOn,
                licenseExpiresOn: form.licenseExpiresOn,
            };

            // Vérification simple côté navigateur.
            if (payload.licenseExpiresOn <= payload.licenseIssuedOn) {
                const message =
                    'Licence expiry date must be after its issue date.';
                setError(message);
                toast.error(message, 'Driving licence');
                return;
            }

            // Envoyer les données au backend via Next.js.
            const response = await fetch('/api/customer-profile', {
                method: isUpdate ? 'PATCH' : 'POST',

                headers: {
                    'Content-Type': 'application/json',
                },

                body: JSON.stringify(payload),
            });

            // Session expirée.
            if (response.status === 401) {
                router.replace('/login');
                return;
            }

            // Le backend reste responsable de valider les données.
            if (!response.ok) {
                const message = await readApiError(response);
                setError(message);
                toast.error(message, 'Customer profile');
                return;
            }

            // Après création, relire le profil depuis la base.
            const profileResponse = await fetch(
                '/api/customer-profile',
                {
                    method: 'GET',
                    cache: 'no-store',
                },
            );

            if (!profileResponse.ok) {
                const message = isUpdate
                    ? 'Profile updated. Refresh the page to display its details.'
                    : 'Profile created. Refresh the page to display its details.';
                setSuccess(message);
                toast.success(message, 'Customer profile');
                return;
            }

            const savedProfile: CustomerProfile =
                await profileResponse.json();

            setProfile(savedProfile);
            setMode('view');
            setEditing(false);

            const message = isUpdate
                ? 'Customer profile updated successfully.'
                : 'Customer profile created successfully.';
            setSuccess(message);
            toast.success(message, 'Customer profile');
        } catch {
            const message =
                'Unable to save your profile. Please try again.';
            setError(message);
            toast.error(message, 'Customer profile');
        } finally {
            setSubmitting(false);
        }
    }

    // ========================================================
    // CHARGEMENT
    // ========================================================

    if (mode === 'loading') {
        return (
            <main className={styles.centerPage}>
                Loading customer profile...
            </main>
        );
    }

    // ========================================================
    // INTERFACE PRINCIPALE
    // ========================================================

    return (
        <main className={styles.page}>

            {/* ================================================= */}
            {/* CONTENU                                          */}
            {/* ================================================= */}

            <section className={styles.container}>

                <Link href="/account" className={styles.backLink}>
                    ← Back to account
                </Link>

                <span className={styles.eyebrow}>
                    CUSTOMER PROFILE
                </span>

                <h1>
                    Personal details & driving licence
                </h1>

                <p className={styles.intro}>
                    Complete your personal information and driving
                    licence details to prepare for a luxury car reservation.
                </p>

                {/* ================================================= */}
                {/* MESSAGES                                        */}
                {/* ================================================= */}

                {error && (
                    <div className={styles.error} role="alert">
                        {error}
                    </div>
                )}

                {success && (
                    <div className={styles.success} role="status">
                        {success}
                    </div>
                )}

                {/* ================================================= */}
                {/* PROFIL DÉJÀ CRÉÉ                                */}
                {/* ================================================= */}

                {mode === 'view' && profile && !editing && (
                    <>
                        <div className={styles.profileGrid}>

                        {/* INFORMATIONS PERSONNELLES */}

                        <article className={styles.card}>
                            <span className={styles.cardLabel}>
                                PERSONAL INFORMATION
                            </span>

                            <div className={styles.details}>
                                <div>
                                    <span>Date of birth</span>
                                    <strong>
                                        {profile.dateOfBirth?.slice(0, 10) || '-'}
                                    </strong>
                                </div>

                                <div>
                                    <span>Address</span>
                                    <strong>{profile.addressLine || '-'}</strong>
                                </div>

                                <div>
                                    <span>City</span>
                                    <strong>{profile.city || '-'}</strong>
                                </div>

                                <div>
                                    <span>Postal code</span>
                                    <strong>{profile.postalCode || '-'}</strong>
                                </div>

                                <div>
                                    <span>Country</span>
                                    <strong>{profile.country || '-'}</strong>
                                </div>
                            </div>
                        </article>

                        {/* INFORMATIONS PERMIS */}

                        <article className={styles.card}>
                            <span className={styles.cardLabel}>
                                DRIVING LICENCE
                            </span>

                            <div className={styles.details}>
                                <div>
                                    <span>Licence number</span>
                                    <strong>{profile.licenseNumber || '-'}</strong>
                                </div>

                                <div>
                                    <span>Country</span>
                                    <strong>{profile.licenseCountry || '-'}</strong>
                                </div>

                                <div>
                                    <span>Issued on</span>
                                    <strong>
                                        {profile.licenseIssuedOn?.slice(0, 10) || '-'}
                                    </strong>
                                </div>

                                <div>
                                    <span>Expires on</span>
                                    <strong>
                                        {profile.licenseExpiresOn?.slice(0, 10) || '-'}
                                    </strong>
                                </div>
                            </div>

                            {/* Le permis est contrôlé automatiquement
                                lors de la confirmation d'une réservation. */}

                            <div className={styles.licenceInfo}>
                                Licence validity is checked automatically
                                when a reservation is confirmed.
                            </div>

                        </article>

                        </div>

                        <div className={styles.actions}>
                            <button
                                type="button"
                                className={styles.submitButton}
                                onClick={startEditing}
                            >
                                Edit profile
                            </button>
                        </div>
                    </>
                )}

                {/* ================================================= */}
                {/* FORMULAIRE DE CRÉATION                          */}
                {/* ================================================= */}

                {(mode === 'create' || editing) && (
                    <form
                        className={styles.form}
                        onSubmit={handleSubmit}
                    >

                        {/* INFORMATIONS PERSONNELLES */}

                        <section className={styles.formSection}>
                            <span className={styles.sectionLabel}>
                                PERSONAL INFORMATION
                            </span>

                            <div className={styles.formGrid}>

                                <div className={styles.field}>
                                    <label htmlFor="dateOfBirth">
                                        Date of birth
                                    </label>

                                    <input
                                        id="dateOfBirth"
                                        type="date"
                                        required
                                        value={form.dateOfBirth}
                                        onChange={(event) =>
                                            updateField('dateOfBirth', event.target.value)
                                        }
                                    />
                                </div>

                                <div className={styles.field}>
                                    <label htmlFor="addressLine">
                                        Address
                                    </label>

                                    <input
                                        id="addressLine"
                                        type="text"
                                        required
                                        placeholder="Street address"
                                        value={form.addressLine}
                                        onChange={(event) =>
                                            updateField('addressLine', event.target.value)
                                        }
                                    />
                                </div>

                                <div className={styles.field}>
                                    <label htmlFor="city">
                                        City
                                    </label>

                                    <input
                                        id="city"
                                        type="text"
                                        required
                                        placeholder="Debrecen"
                                        value={form.city}
                                        onChange={(event) =>
                                            updateField('city', event.target.value)
                                        }
                                    />
                                </div>

                                <div className={styles.field}>
                                    <label htmlFor="postalCode">
                                        Postal code
                                    </label>

                                    <input
                                        id="postalCode"
                                        type="text"
                                        required
                                        placeholder="4024"
                                        value={form.postalCode}
                                        onChange={(event) =>
                                            updateField('postalCode', event.target.value)
                                        }
                                    />
                                </div>

                                <div className={styles.field}>
                                    <label htmlFor="country">
                                        Country code
                                    </label>

                                    <input
                                        id="country"
                                        type="text"
                                        required
                                        minLength={2}
                                        maxLength={2}
                                        pattern="[A-Za-z]{2}"
                                        placeholder="HU"
                                        value={form.country}
                                        onChange={(event) =>
                                            updateField('country', event.target.value)
                                        }
                                    />
                                </div>

                            </div>
                        </section>

                        {/* INFORMATIONS PERMIS */}

                        <section className={styles.formSection}>
                            <span className={styles.sectionLabel}>
                                DRIVING LICENCE
                            </span>

                            <div className={styles.formGrid}>

                                <div className={styles.field}>
                                    <label htmlFor="licenseNumber">
                                        Licence number
                                    </label>

                                    <input
                                        id="licenseNumber"
                                        type="text"
                                        required
                                        placeholder="Licence number"
                                        value={form.licenseNumber}
                                        onChange={(event) =>
                                            updateField('licenseNumber', event.target.value)
                                        }
                                    />
                                </div>

                                <div className={styles.field}>
                                    <label htmlFor="licenseCountry">
                                        Licence country
                                    </label>

                                    <input
                                        id="licenseCountry"
                                        type="text"
                                        required
                                        minLength={2}
                                        maxLength={2}
                                        pattern="[A-Za-z]{2}"
                                        placeholder="HU"
                                        value={form.licenseCountry}
                                        onChange={(event) =>
                                            updateField('licenseCountry', event.target.value)
                                        }
                                    />
                                </div>

                                <div className={styles.field}>
                                    <label htmlFor="licenseIssuedOn">
                                        Issued on
                                    </label>

                                    <input
                                        id="licenseIssuedOn"
                                        type="date"
                                        required
                                        value={form.licenseIssuedOn}
                                        onChange={(event) =>
                                            updateField('licenseIssuedOn', event.target.value)
                                        }
                                    />
                                </div>

                                <div className={styles.field}>
                                    <label htmlFor="licenseExpiresOn">
                                        Expires on
                                    </label>

                                    <input
                                        id="licenseExpiresOn"
                                        type="date"
                                        required
                                        value={form.licenseExpiresOn}
                                        onChange={(event) =>
                                            updateField('licenseExpiresOn', event.target.value)
                                        }
                                    />
                                </div>

                            </div>
                        </section>

                        {/* BOUTON DE CRÉATION */}

                        <button
                            type="submit"
                            className={styles.submitButton}
                            disabled={submitting}
                        >
                            {submitting
                                ? 'Saving profile...'
                                : profile
                                    ? 'Save changes'
                                    : 'Save customer profile'}
                        </button>

                        {editing && (
                            <button
                                type="button"
                                className={styles.cancelButton}
                                onClick={cancelEditing}
                                disabled={submitting}
                            >
                                Cancel
                            </button>
                        )}

                    </form>
                )}

                {/* ERREUR LORS DU CHARGEMENT */}

                {mode === 'error' && (
                    <Link href="/account" className={styles.backLink}>
                        Return to account
                    </Link>
                )}

            </section>

        </main>
    );
}

