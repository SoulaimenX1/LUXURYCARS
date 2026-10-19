'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    useEffect,
    useState,
    type FormEvent,
} from 'react';

import { useToast } from '@/components/toast';

import styles from './account.module.css';

// ==========================================================
// TYPE DE L'UTILISATEUR CONNECTÉ
// ==========================================================

interface AuthenticatedUser {
    id?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string | null;
    role?: string;
    status?: string;
}

// ==========================================================
// PAGE CUSTOMER DASHBOARD
// ==========================================================

export default function AccountPage() {
    const router = useRouter();
    const toast = useToast();

    const [user, setUser] =
        useState<AuthenticatedUser | null>(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Aucun permis enregistré : le client reçoit une invitation
    // visible à compléter son profil.
    const [licenceMissing, setLicenceMissing] = useState(false);

    // Formulaire « informations personnelles » (téléphone obligatoire).
    const [form, setForm] = useState({
        firstName: '',
        lastName: '',
        phone: '',
    });

    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [saveMessage, setSaveMessage] = useState('');

    // ======================================================
    // CHARGER L'UTILISATEUR CONNECTÉ
    // ======================================================

    useEffect(() => {
        let active = true;

        async function loadUser() {
            try {
                const response = await fetch('/api/auth/me', {
                    method: 'GET',
                    cache: 'no-store',
                });

                // Aucun JWT valide : retour au login.
                if (response.status === 401) {
                    router.replace('/login');
                    return;
                }

                if (!response.ok) {
                    throw new Error('Unable to retrieve account.');
                }

                const data: AuthenticatedUser =
                    await response.json();

                if (!data || typeof data.email !== 'string') {
                    throw new Error('Invalid account response.');
                }

                // Un administrateur ne doit pas utiliser
                // l'espace réservé aux clients.
                if (data.role === 'admin') {
                    router.replace('/admin');
                    return;
                }

                // Tout autre rôle inattendu est refusé.
                if (data.role !== 'customer') {
                    router.replace('/login');
                    return;
                }

                if (active) {
                    setUser(data);

                    setForm({
                        firstName: data.firstName ?? '',
                        lastName: data.lastName ?? '',
                        phone: data.phone ?? '',
                    });
                }

                // Le profil client (permis de conduire) est
                // distinct du compte : le backend renvoie 404
                // tant que le client n'a pas enregistré son permis.
                try {
                    const profileResponse = await fetch(
                        '/api/customer-profile',
                        {
                            method: 'GET',
                            cache: 'no-store',
                        },
                    );

                    if (active) {
                        setLicenceMissing(
                            profileResponse.status === 404,
                        );
                    }
                } catch {
                    // Une erreur réseau ne doit pas masquer
                    // le tableau de bord.
                }
            } catch {
                if (active) {
                    setError(
                        'Unable to load your account information.',
                    );
                }
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        }

        void loadUser();

        return () => {
            active = false;
        };
    }, [router]);

    // ======================================================
    // ENREGISTRER LES INFORMATIONS PERSONNELLES
    // ======================================================

    async function savePersonalInformation(
        event: FormEvent<HTMLFormElement>,
    ) {
        event.preventDefault();

        setSaveError('');
        setSaveMessage('');

        const phone = form.phone.trim();

        // Le numéro de téléphone est obligatoire.
        if (!phone) {
            const message = 'A phone number is required.';
            setSaveError(message);
            toast.error(message, 'Personal information');
            return;
        }

        if (!/^\+?[0-9 ().-]{6,30}$/.test(phone)) {
            const message = 'Please enter a valid phone number.';
            setSaveError(message);
            toast.error(message, 'Personal information');
            return;
        }

        setSaving(true);

        try {
            const response = await fetch('/api/profile', {
                method: 'PATCH',

                headers: {
                    'Content-Type': 'application/json',
                },

                body: JSON.stringify({
                    firstName: form.firstName.trim(),
                    lastName: form.lastName.trim(),
                    phone,
                }),
            });

            const data = (await response
                .json()
                .catch(() => null)) as
                | (AuthenticatedUser & {
                      message?: string | string[];
                  })
                | null;

            if (!response.ok) {
                const rawMessage = data?.message;

                throw new Error(
                    Array.isArray(rawMessage)
                        ? rawMessage.join(' ')
                        : rawMessage ||
                              'Unable to save your information.',
                );
            }

            // Le backend renvoie le profil public mis à jour.
            setUser((previous) => ({
                ...previous,
                ...(data ?? {}),
            }));

            setSaveMessage(
                'Your information has been saved.',
            );
            toast.success(
                'Your information has been saved.',
                'Personal information',
            );
        } catch (caught) {
            const message =
                caught instanceof Error
                    ? caught.message
                    : 'Unable to save your information.';
            setSaveError(message);
            toast.error(message, 'Personal information');
        } finally {
            setSaving(false);
        }
    }

    // ======================================================
    // CHARGEMENT
    // ======================================================

    if (loading) {
        return (
            <main className={styles.centerPage}>
                <div className={styles.loadingCard}>
                    <span className={styles.loadingMark}>L</span>
                    <p>Loading your account...</p>
                </div>
            </main>
        );
    }

    // ======================================================
    // ERREUR
    // ======================================================

    if (!user) {
        return (
            <main className={styles.centerPage}>
                <div className={styles.errorCard}>
                    <span className={styles.eyebrow}>
                        CUSTOMER AREA
                    </span>

                    <h1>Account unavailable</h1>

                    <p>
                        {error ||
                            'Unable to retrieve your account.'}
                    </p>

                    <Link
                        href="/login"
                        className={styles.primaryButton}
                    >
                        Return to sign in
                    </Link>
                </div>
            </main>
        );
    }

    // ======================================================
    // INFORMATIONS À AFFICHER
    // ======================================================

    const fullName =
        [user.firstName, user.lastName]
            .filter(Boolean)
            .join(' ') || 'Customer';

    const initials =
        `${user.firstName?.charAt(0) ?? ''}${user.lastName?.charAt(0) ?? ''}`
            .toUpperCase() || 'C';

    const firstName =
        user.firstName || 'Customer';

    // ======================================================
    // INTERFACE CLIENT
    // ======================================================

    return (
        <main className={styles.page}>

            {/* ================================================= */}
            {/* DASHBOARD                                        */}
            {/* ================================================= */}

            <div className={styles.dashboard}>

                {/* INTRODUCTION */}

                <section className={styles.intro}>
                    <div>
                        <span className={styles.eyebrow}>
                            YOUR PRIVATE GARAGE
                        </span>

                        <h1>
                            Welcome, {firstName}
                        </h1>

                        <p>
                            Everything you need to discover,
                            reserve and manage your luxury
                            rental experience.
                        </p>
                    </div>

                    <div className={styles.customerBadge}>
                        <span className={styles.avatar}>
                            {initials}
                        </span>

                        <div>
                            <strong>{fullName}</strong>
                            <span>{user.email}</span>
                        </div>
                    </div>
                </section>

                {error && (
                    <div
                        className={styles.errorBanner}
                        role="alert"
                    >
                        {error}
                    </div>
                )}

                {/* ================================================= */}
                {/* PERMIS MANQUANT — AVERTISSEMENT                   */}
                {/* ================================================= */}

                {licenceMissing && (
                    <section
                        className={styles.licenceBanner}
                        role="alert"
                    >
                        <div className={styles.licenceText}>
                            <span
                                className={styles.licenceEyebrow}
                            >
                                DRIVING LICENCE REQUIRED
                            </span>

                            <h2>
                                You must register your driving
                                licence
                            </h2>

                            <p>
                                Add your driving licence details
                                to your profile to be able to book
                                a vehicle.
                            </p>
                        </div>

                        <Link
                            href="/account/profile"
                            className={styles.licenceCta}
                        >
                            Register my licence
                            <span aria-hidden="true">→</span>
                        </Link>
                    </section>
                )}

                {/* ================================================= */}
                {/* RÉSERVATIONS — ACCÈS PRIVILÉGIÉ                   */}
                {/* ================================================= */}

                <section className={styles.reservationsBanner}>
                    <div className={styles.reservationsText}>
                        <span
                            className={styles.reservationsEyebrow}
                        >
                            RESERVATIONS
                        </span>

                        <h2>Your reservations &amp; status</h2>

                        <p>
                            Track every booking — pending,
                            confirmed, cancelled or completed —
                            in one place.
                        </p>
                    </div>

                    <Link
                        href="/account/reservations"
                        className={styles.reservationsCta}
                    >
                        View my reservations
                        <span aria-hidden="true">→</span>
                    </Link>
                </section>

                {/* ================================================= */}
                {/* ACTIONS PRINCIPALES                               */}
                {/* ================================================= */}

                <section className={styles.quickSection}>
                    <div className={styles.sectionTitle}>
                        <span>QUICK ACCESS</span>
                        <h2>What would you like to do?</h2>
                    </div>

                    <div className={styles.actionGrid}>

                        <Link
                            href="/vehicles"
                            className={styles.actionCard}
                        >
                            <span className={styles.actionNumber}>
                                01
                            </span>

                            <div>
                                <h3>Browse cars</h3>
                                <p>
                                    Explore the luxury vehicle
                                    collection.
                                </p>
                            </div>

                            <span className={styles.arrow}>
                                →
                            </span>
                        </Link>

                        <Link
                            href="/contact"
                            className={styles.actionCard}
                        >
                            <span className={styles.actionNumber}>
                                02
                            </span>

                            <div>
                                <h3>Contact us</h3>
                                <p>
                                    Reach our team in Budapest
                                    for any request.
                                </p>
                            </div>

                            <span className={styles.arrow}>
                                →
                            </span>
                        </Link>

                        <Link
                            href="/account/reservations"
                            className={styles.actionCard}
                        >
                            <span className={styles.actionNumber}>
                                03
                            </span>

                            <div>
                                <h3>My reservations</h3>
                                <p>
                                    Review and manage your current
                                    bookings.
                                </p>
                            </div>

                            <span className={styles.arrow}>
                                →
                            </span>
                        </Link>

                        <Link
                            href="/account/profile"
                            className={styles.actionCard}
                        >
                            <span className={styles.actionNumber}>
                                04
                            </span>

                            <div>
                                <h3>Profile & licence</h3>
                                <p>
                                    Manage personal information and
                                    driving licence details.
                                </p>
                            </div>

                            <span className={styles.arrow}>
                                →
                            </span>
                        </Link>

                        <Link
                            href="/account/rentals"
                            className={styles.actionCard}
                        >
                            <span className={styles.actionNumber}>05</span>
                            <div>
                                <h3>My rentals</h3>
                                <p>Track active rentals, pickup details and rental history.</p>
                            </div>
                            <span className={styles.arrow}>→</span>
                        </Link>
                        <Link href="/account/premium" className={styles.actionCard}>
                          <span className={styles.actionNumber}>06</span>
                          <div><h3>My premium collection</h3><p>Saved vehicles, membership tier and verified reviews.</p></div>
                          <span className={styles.arrow}>→</span>
                        </Link>
                    </div>
                </section>

                {/* ================================================= */}
                {/* RÉSUMÉ DU COMPTE                                 */}
                {/* ================================================= */}

                <section className={styles.accountSection}>

                    <div className={styles.sectionTitle}>
                        <span>ACCOUNT</span>
                        <h2>Your details</h2>
                    </div>

                    <div className={styles.accountCard}>

                        <div className={styles.accountIdentity}>
                            <span className={styles.largeAvatar}>
                                {initials}
                            </span>

                            <div>
                                <h3>{fullName}</h3>
                                <p>{user.email}</p>
                            </div>
                        </div>

                        <div className={styles.detailsGrid}>

                            <div className={styles.detail}>
                                <span>First name</span>
                                <strong>
                                    {user.firstName ||
                                        'Not provided'}
                                </strong>
                            </div>

                            <div className={styles.detail}>
                                <span>Last name</span>
                                <strong>
                                    {user.lastName ||
                                        'Not provided'}
                                </strong>
                            </div>

                            <div className={styles.detail}>
                                <span>Phone</span>
                                <strong>
                                    {user.phone ||
                                        'Not provided'}
                                </strong>
                            </div>

                            <div className={styles.detail}>
                                <span>Status</span>
                                <strong
                                    className={styles.status}
                                >
                                    {user.status ||
                                        'Not available'}
                                </strong>
                            </div>

                        </div>

                        <Link
                            href="/account/profile"
                            className={styles.profileButton}
                        >
                            Edit profile
                            <span aria-hidden="true">→</span>
                        </Link>

                    </div>
                </section>

                {/* ================================================= */}
                {/* INFORMATIONS PERSONNELLES (ÉDITABLES)             */}
                {/* ================================================= */}

                <section className={styles.accountSection}>

                    <div className={styles.sectionTitle}>
                        <span>PERSONAL INFORMATION</span>
                        <h2>Update your details</h2>
                    </div>

                    <form
                        className={styles.editCard}
                        onSubmit={savePersonalInformation}
                    >

                        <div className={styles.editFields}>

                            <label className={styles.editField}>
                                <span>First name</span>

                                <input
                                    type="text"
                                    autoComplete="given-name"
                                    value={form.firstName}
                                    onChange={(event) =>
                                        setForm((previous) => ({
                                            ...previous,
                                            firstName:
                                                event.target.value,
                                        }))
                                    }
                                />
                            </label>

                            <label className={styles.editField}>
                                <span>Last name</span>

                                <input
                                    type="text"
                                    autoComplete="family-name"
                                    value={form.lastName}
                                    onChange={(event) =>
                                        setForm((previous) => ({
                                            ...previous,
                                            lastName:
                                                event.target.value,
                                        }))
                                    }
                                />
                            </label>

                            <label className={styles.editField}>
                                <span>
                                    Phone number
                                    <em aria-hidden="true">
                                        {' '}
                                        *
                                    </em>
                                </span>

                                <input
                                    type="tel"
                                    autoComplete="tel"
                                    placeholder="+216 ..."
                                    required
                                    value={form.phone}
                                    onChange={(event) =>
                                        setForm((previous) => ({
                                            ...previous,
                                            phone:
                                                event.target.value,
                                        }))
                                    }
                                />
                            </label>

                            <label className={styles.editField}>
                                <span>Email</span>

                                <input
                                    type="email"
                                    value={user.email ?? ''}
                                    readOnly
                                    disabled
                                />
                            </label>

                        </div>

                        {saveError && (
                            <p
                                className={styles.saveError}
                                role="alert"
                            >
                                {saveError}
                            </p>
                        )}

                        {saveMessage && (
                            <p
                                className={styles.saveMessage}
                                role="status"
                            >
                                {saveMessage}
                            </p>
                        )}

                        <button
                            type="submit"
                            className={styles.saveButton}
                            disabled={saving}
                        >
                            {saving
                                ? 'Saving...'
                                : 'Save changes'}
                        </button>

                    </form>
                </section>

            </div>
        </main>
    );
}
