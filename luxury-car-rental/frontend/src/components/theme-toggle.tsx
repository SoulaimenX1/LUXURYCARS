'use client';

import { useSyncExternalStore } from 'react';

import styles from './theme-toggle.module.css';

// ==========================================================
// BASCULE CLAIR / SOMBRE
// ==========================================================
//
// Le thème est stocké dans localStorage sous « luxury-theme »
// et appliqué via l'attribut data-theme sur <html>.
// Le script du layout l'applique avant le premier rendu.
//
// Le thème est lu comme un store externe via
// useSyncExternalStore : le serveur rend « light » (icône
// lune), puis le client rafraîchit l'icône après
// l'hydratation — sans setState dans un effet.
// ==========================================================

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'luxury-theme';

// Événement émis localement lorsque le thème change, afin de
// prévenir les abonnés (y compris d'autres instances).
const THEME_EVENT = 'luxury-theme-change';

function readTheme(): Theme {
    if (typeof document === 'undefined') {
        return 'light';
    }

    return document.documentElement.getAttribute(
        'data-theme',
    ) === 'dark'
        ? 'dark'
        : 'light';
}

function subscribe(onStoreChange: () => void): () => void {
    window.addEventListener(THEME_EVENT, onStoreChange);
    window.addEventListener('storage', onStoreChange);

    return () => {
        window.removeEventListener(THEME_EVENT, onStoreChange);
        window.removeEventListener('storage', onStoreChange);
    };
}

function getServerTheme(): Theme {
    return 'light';
}

export default function ThemeToggle() {
    const theme = useSyncExternalStore(
        subscribe,
        readTheme,
        getServerTheme,
    );

    function toggleTheme() {
        const next: Theme =
            theme === 'dark' ? 'light' : 'dark';

        document.documentElement.setAttribute(
            'data-theme',
            next,
        );

        try {
            localStorage.setItem(STORAGE_KEY, next);
        } catch {
            // Le stockage peut être indisponible (mode privé).
        }

        window.dispatchEvent(new Event(THEME_EVENT));
    }

    const isDark = theme === 'dark';

    return (
        <button
            type="button"
            className={styles.toggle}
            onClick={toggleTheme}
            aria-label={
                isDark
                    ? 'Activer le thème clair'
                    : 'Activer le thème sombre'
            }
            title={
                isDark
                    ? 'Switch to light theme'
                    : 'Switch to dark theme'
            }
        >
            {/* Icône : soleil / lune (lune rendue par le serveur
                pour éviter toute incohérence d'hydratation). */}
            {isDark ? (
                <svg
                    viewBox="0 0 24 24"
                    width="18"
                    height="18"
                    aria-hidden="true"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <circle cx="12" cy="12" r="4.2" />
                    <path d="M12 2.6v2.2M12 19.2v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.6 12h2.2M19.2 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6" />
                </svg>
            ) : (
                <svg
                    viewBox="0 0 24 24"
                    width="18"
                    height="18"
                    aria-hidden="true"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5z" />
                </svg>
            )}
        </button>
    );
}
