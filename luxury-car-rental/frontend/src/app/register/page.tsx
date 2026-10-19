'use client';

import {
    FormEvent,
    useState,
} from 'react';

import Link from 'next/link';

import {
    useRouter,
} from 'next/navigation';

import { useToast } from '@/components/toast';
import styles from '../auth.module.css';

// ==========================================================
// RÉPONSE POSSIBLE DU BACKEND
// ==========================================================

interface RegisterResponse {
    id?: string;
    email?: string;
    role?: string;

    message?: string | string[];
}

// ==========================================================
// PAGE REGISTER
// ==========================================================

export default function RegisterPage() {
    const router =
        useRouter();

    // --------------------------------------------------------
    // CHAMPS
    // --------------------------------------------------------

    const [
        firstName,
        setFirstName,
    ] = useState('');

    const [
        lastName,
        setLastName,
    ] = useState('');

    const [
        email,
        setEmail,
    ] = useState('');

    const [
        phone,
        setPhone,
    ] = useState('');

    const [
        password,
        setPassword,
    ] = useState('');

    const [
        confirmPassword,
        setConfirmPassword,
    ] = useState('');

    // --------------------------------------------------------
    // ÉTATS UI
    // --------------------------------------------------------

    const [
        loading,
        setLoading,
    ] = useState(false);

    const [
        error,
        setError,
    ] = useState('');

    const [
        success,
        setSuccess,
    ] = useState('');

    const toast = useToast();

    // ========================================================
    // INSCRIPTION
    // ========================================================

    async function handleSubmit(
        event: FormEvent<HTMLFormElement>,
    ) {
        event.preventDefault();

        setError('');
        setSuccess('');

        // ------------------------------------------------------
        // VÉRIFICATIONS AVANT L'API
        // ------------------------------------------------------

        if (
            password.length < 12
        ) {
            const message =
                'Password must contain at least 12 characters.';
            setError(message);
            toast.error(message, 'Create account');

            return;
        }

        if (
            password !==
            confirmPassword
        ) {
            const message = 'Passwords do not match.';
            setError(message);
            toast.error(message, 'Create account');

            return;
        }

        setLoading(true);

        try {
            const response =
                await fetch(
                    '/api/auth/register',
                    {
                        method:
                            'POST',

                        headers: {
                            'Content-Type':
                                'application/json',
                        },

                        body:
                            JSON.stringify({
                                firstName,
                                lastName,
                                email,
                                phone,
                                password,
                            }),
                    },
                );

            const data =
                await response
                    .json() as RegisterResponse;

            // ----------------------------------------------------
            // ERREURS BACKEND
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

                const failure =
                    message ?? 'Unable to create the account.';

                setError(failure);
                toast.error(failure, 'Create account');

                return;
            }

            // ----------------------------------------------------
            // SUCCÈS
            // ----------------------------------------------------

            const message =
                'Account created successfully. Redirecting to sign in...';
            setSuccess(message);
            toast.success(message, 'Welcome to Luxury Cars');

            // Attendre légèrement pour montrer
            // le message de succès.
            window.setTimeout(
                () => {
                    router.push(
                        '/login',
                    );
                },
                1200,
            );
        } catch {
            const message =
                'The registration service is currently unavailable.';
            setError(message);
            toast.error(message, 'Create account');
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className={styles.page}>

            {/* ============================================= */}
            {/* VISUEL */}
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
                        JOIN THE EXPERIENCE
                    </span>

                    <h1>
                        Your journey
                        <span>
                            starts here
                        </span>
                    </h1>

                    <p>
                        Create your customer account
                        to check availability, manage
                        your profile and reserve premium
                        vehicles.
                    </p>
                </div>

                <span
                    className={
                        styles.visualFooter
                    }
                >
                    CUSTOMER REGISTRATION · SECURE ACCOUNT
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
                        CREATE ACCOUNT
                    </span>

                    <h2>
                        Become a customer
                    </h2>

                    <p
                        className={
                            styles.formSubtitle
                        }
                    >
                        Create your account before
                        completing your driving licence
                        and reservation profile.
                    </p>

                    <form
                        className={
                            styles.form
                        }
                        onSubmit={
                            handleSubmit
                        }
                    >

                        {/* --------------------------------------- */}
                        {/* NOM + PRÉNOM */}
                        {/* --------------------------------------- */}

                        <div
                            className={
                                styles.nameGrid
                            }
                        >
                            <div
                                className={
                                    styles.field
                                }
                            >
                                <label
                                    htmlFor="firstName"
                                >
                                    First name
                                </label>

                                <input
                                    id="firstName"
                                    name="firstName"
                                    type="text"
                                    autoComplete="given-name"
                                    placeholder="First name"
                                    required
                                    value={firstName}
                                    onChange={(
                                        event,
                                    ) =>
                                        setFirstName(
                                            event.target.value,
                                        )
                                    }
                                />
                            </div>

                            <div
                                className={
                                    styles.field
                                }
                            >
                                <label
                                    htmlFor="lastName"
                                >
                                    Last name
                                </label>

                                <input
                                    id="lastName"
                                    name="lastName"
                                    type="text"
                                    autoComplete="family-name"
                                    placeholder="Last name"
                                    required
                                    value={lastName}
                                    onChange={(
                                        event,
                                    ) =>
                                        setLastName(
                                            event.target.value,
                                        )
                                    }
                                />
                            </div>
                        </div>

                        {/* --------------------------------------- */}
                        {/* EMAIL */}
                        {/* --------------------------------------- */}

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

                        {/* --------------------------------------- */}
                        {/* TÉLÉPHONE */}
                        {/* --------------------------------------- */}

                        <div
                            className={
                                styles.field
                            }
                        >
                            <label
                                htmlFor="phone"
                            >
                                Phone number
                                {' '}
                                (optional)
                            </label>

                            <input
                                id="phone"
                                name="phone"
                                type="tel"
                                autoComplete="tel"
                                placeholder="+36 ..."
                                value={phone}
                                onChange={(
                                    event,
                                ) =>
                                    setPhone(
                                        event.target.value,
                                    )
                                }
                            />
                        </div>

                        {/* --------------------------------------- */}
                        {/* MOT DE PASSE */}
                        {/* --------------------------------------- */}

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
                                autoComplete="new-password"
                                placeholder="Minimum 12 characters"
                                minLength={12}
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

                            <span
                                className={
                                    styles.passwordHint
                                }
                            >
                                Your password must contain
                                at least 12 characters.
                            </span>
                        </div>

                        {/* --------------------------------------- */}
                        {/* CONFIRMATION */}
                        {/* --------------------------------------- */}

                        <div
                            className={
                                styles.field
                            }
                        >
                            <label
                                htmlFor="confirmPassword"
                            >
                                Confirm password
                            </label>

                            <input
                                id="confirmPassword"
                                name="confirmPassword"
                                type="password"
                                autoComplete="new-password"
                                placeholder="Repeat your password"
                                minLength={12}
                                required
                                value={confirmPassword}
                                onChange={(
                                    event,
                                ) =>
                                    setConfirmPassword(
                                        event.target.value,
                                    )
                                }
                            />
                        </div>

                        {/* --------------------------------------- */}
                        {/* MESSAGES */}
                        {/* --------------------------------------- */}

                        {error && (
                            <div
                                className={
                                    styles.error
                                }
                            >
                                {error}
                            </div>
                        )}

                        {success && (
                            <div
                                className={
                                    styles.success
                                }
                            >
                                {success}
                            </div>
                        )}

                        {/* --------------------------------------- */}
                        {/* SUBMIT */}
                        {/* --------------------------------------- */}

                        <button
                            className={
                                styles.submitButton
                            }
                            type="submit"
                            disabled={loading}
                        >
                            {loading
                                ? 'Creating account...'
                                : 'Create account'}
                        </button>

                    </form>

                    <p
                        className={
                            styles.switchText
                        }
                    >
                        Already registered?{' '}

                        <Link href="/login">
                            Sign in
                        </Link>
                    </p>

                </div>
            </section>

        </main>
    );
}
