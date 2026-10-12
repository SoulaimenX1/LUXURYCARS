'use client';

import {
    FormEvent,
    useState,
} from 'react';

import Link from 'next/link';

import {
    useRouter,
} from 'next/navigation';

import styles from '../auth.module.css';

// ==========================================================
// TYPE DE LA RÉPONSE LOGIN
// ==========================================================

interface LoginResponse {
    user?: {
        id?: string;
        email?: string;
        firstName?: string;
        lastName?: string;
        role?: string;
        status?: string;
    };

    message?:
    | string
    | string[];
}

// ==========================================================
// PAGE LOGIN
// ==========================================================

export default function LoginPage() {
    const router =
        useRouter();

    // --------------------------------------------------------
    // CHAMPS DU FORMULAIRE
    // --------------------------------------------------------

    const [
        email,
        setEmail,
    ] = useState('');

    const [
        password,
        setPassword,
    ] = useState('');

    // --------------------------------------------------------
    // ÉTAT DE L'INTERFACE
    // --------------------------------------------------------

    const [
        loading,
        setLoading,
    ] = useState(false);

    const [
        error,
        setError,
    ] = useState('');

    // ========================================================
    // SOUMISSION DU LOGIN
    // ========================================================

    async function handleSubmit(
        event: FormEvent<HTMLFormElement>,
    ) {
        // Empêcher le rechargement classique de la page.
        event.preventDefault();

        // Réinitialiser l'erreur précédente.
        setError('');

        // Activer l'état de chargement.
        setLoading(true);

        try {
            // ----------------------------------------------------
            // APPELER NOTRE API NEXT.JS
            // ----------------------------------------------------

            const response =
                await fetch(
                    '/api/auth/login',
                    {
                        method:
                            'POST',

                        headers: {
                            'Content-Type':
                                'application/json',
                        },

                        body:
                            JSON.stringify({
                                email,
                                password,
                            }),
                    },
                );

            // ----------------------------------------------------
            // LIRE LA RÉPONSE
            // ----------------------------------------------------
            //
            // On utilise une déclaration typée directe.
            //
            // Cela évite l'erreur Turbopack rencontrée
            // avec :
            //
            // await response.json() as LoginResponse
            //
            // ----------------------------------------------------

            const data: LoginResponse =
                await response.json();

            // ----------------------------------------------------
            // LOGIN REFUSÉ
            // ----------------------------------------------------

            if (!response.ok) {
                const message =
                    Array.isArray(
                        data.message,
                    )
                        ? data.message.join(
                            ' ',
                        )
                        : data.message;

                setError(
                    message ??
                    'Unable to sign in.',
                );

                return;
            }

            // ----------------------------------------------------
            // ADMIN
            // ----------------------------------------------------
            //
            // Le dashboard admin sera développé plus tard.
            //
            // Pour le moment, un administrateur retourne
            // simplement vers la page d'accueil.
            // ----------------------------------------------------

            // ==========================================================
            // REDIRECTION SELON LE RÔLE
            // ==========================================================

            if (data.user?.role === 'admin') {
                router.replace('/admin');
                router.refresh();
                return;
            }

            if (data.user?.role === 'customer') {
                router.replace('/account');
                router.refresh();
                return;
            }

            // ----------------------------------------------------
            // RÔLE NON SUPPORTÉ
            // ----------------------------------------------------
            //
            // Aucune redirection : on affiche l'erreur
            // et on laisse l'utilisateur sur la page.
            // ----------------------------------------------------

            setError('This account role is not supported.');
            return;
        } catch {
            // ----------------------------------------------------
            // ERREUR RÉSEAU OU SERVEUR
            // ----------------------------------------------------

            setError(
                'The authentication service is currently unavailable.',
            );
        } finally {
            // Désactiver l'état de chargement.
            setLoading(
                false,
            );
        }
    }

    return (
        <main
            className={
                styles.page
            }
        >

            {/* ============================================= */}
            {/* PARTIE VISUELLE */}
            {/* ============================================= */}

            <section
                className={
                    styles.visualSection
                }
            >

                <Link
                    href="/"
                    className={
                        styles.logo
                    }
                >

                    <span
                        className={
                            styles.logoMark
                        }
                    >
                        L
                    </span>

                    <span
                        className={
                            styles.logoText
                        }
                    >
                        <strong>
                            LUXURY
                        </strong>

                        <span>
                            CAR RENTAL
                        </span>
                    </span>

                </Link>

                <div
                    className={
                        styles.visualContent
                    }
                >

                    <span
                        className={
                            styles.visualLabel
                        }
                    >
                        CUSTOMER ACCESS
                    </span>

                    <h1>
                        Welcome
                        <span>
                            back.
                        </span>
                    </h1>

                    <p>
                        Access your customer account,
                        manage your reservations and
                        continue your premium rental
                        experience.
                    </p>

                </div>

                <span
                    className={
                        styles.visualFooter
                    }
                >
                    SECURE ACCESS · JWT AUTHENTICATION
                </span>

            </section>

            {/* ============================================= */}
            {/* FORMULAIRE */}
            {/* ============================================= */}

            <section
                className={
                    styles.formSection
                }
            >

                <div
                    className={
                        styles.formContainer
                    }
                >

                    <Link
                        href="/"
                        className={
                            styles.backLink
                        }
                    >
                        ← Back to home
                    </Link>

                    <span
                        className={
                            styles.formLabel
                        }
                    >
                        SIGN IN
                    </span>

                    <h2>
                        Access your account
                    </h2>

                    <p
                        className={
                            styles.formSubtitle
                        }
                    >
                        Enter your account credentials
                        to continue.
                    </p>

                    <form
                        className={
                            styles.form
                        }
                        onSubmit={
                            handleSubmit
                        }
                    >

                        {/* ======================================= */}
                        {/* EMAIL */}
                        {/* ======================================= */}

                        <div
                            className={
                                styles.field
                            }
                        >

                            <label
                                htmlFor="email"
                            >
                                Email address
                            </label>

                            <input
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                placeholder="name@example.com"
                                required
                                value={email}
                                onChange={(
                                    event,
                                ) =>
                                    setEmail(
                                        event.target.value,
                                    )
                                }
                            />

                        </div>

                        {/* ======================================= */}
                        {/* PASSWORD */}
                        {/* ======================================= */}

                        <div
                            className={
                                styles.field
                            }
                        >

                            <label
                                htmlFor="password"
                            >
                                Password
                            </label>

                            <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="current-password"
                                placeholder="Enter your password"
                                required
                                value={password}
                                onChange={(
                                    event,
                                ) =>
                                    setPassword(
                                        event.target.value,
                                    )
                                }
                            />

                        </div>

                        {/* ======================================= */}
                        {/* MESSAGE D'ERREUR */}
                        {/* ======================================= */}

                        {error && (
                            <div
                                className={
                                    styles.error
                                }
                            >
                                {error}
                            </div>
                        )}

                        {/* ======================================= */}
                        {/* BOUTON LOGIN */}
                        {/* ======================================= */}

                        <button
                            className={
                                styles.submitButton
                            }
                            type="submit"
                            disabled={
                                loading
                            }
                        >
                            {loading
                                ? 'Signing in...'
                                : 'Sign in'}
                        </button>

                    </form>

                    <p
                        className={
                            styles.switchText
                        }
                    >
                        New customer?{' '}

                        <Link
                            href="/register"
                        >
                            Create an account
                        </Link>
                    </p>

                </div>

            </section>

        </main>
    );
}
