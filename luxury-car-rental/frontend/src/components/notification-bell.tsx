'use client';

import Link from 'next/link';
import {
    useEffect,
    useRef,
    useState,
} from 'react';

import type {
    NotificationItem,
} from '@/lib/catalog-types';

import styles from './notification-bell.module.css';

// ==========================================================
// CLOCHE DE NOTIFICATIONS — LUXURY CARS
// ==========================================================
//
// Affiche les nouveautés du catalogue (nouvelles voitures,
// éditions spéciales et limitées).
//
// Le compteur « non lues » est calculé à partir d'un
// horodatage stocké dans localStorage : aucune table de
// lecture par utilisateur n'est nécessaire.
// ==========================================================

const SEEN_KEY = 'luxury-notifications-seen';

export default function NotificationBell() {
    const [items, setItems] = useState<
        NotificationItem[]
    >([]);

    const [unread, setUnread] = useState(0);
    const [open, setOpen] = useState(false);
    const [mounted, setMounted] = useState(false);

    const containerRef =
        useRef<HTMLDivElement | null>(null);

    // ------------------------------------------
    // Charger le flux de notifications.
    // ------------------------------------------
    useEffect(() => {
        let active = true;

        async function load() {
            try {
                const response = await fetch(
                    '/api/notifications',
                    { cache: 'no-store' },
                );

                if (!active || !response.ok) {
                    return;
                }

                const data =
                    (await response.json()) as NotificationItem[];

                if (!active) {
                    return;
                }

                setItems(data);

                const lastSeen =
                    Number(
                        localStorage.getItem(SEEN_KEY) ?? 0,
                    ) || 0;

                const count = data.filter(
                    (item) =>
                        new Date(item.createdAt).getTime() >
                        lastSeen,
                ).length;

                setUnread(count);
                setMounted(true);
            } catch {
                // Service indisponible : la cloche reste discrète.
            }
        }

        void load();

        // Rafraîchir régulièrement (nouvelles voitures admin).
        const timer = window.setInterval(load, 60000);

        return () => {
            active = false;
            window.clearInterval(timer);
        };
    }, []);

    // ------------------------------------------
    // Fermer au clic extérieur / touche Échap.
    // ------------------------------------------
    useEffect(() => {
        if (!open) {
            return;
        }

        function handleClick(event: MouseEvent) {
            if (
                containerRef.current &&
                !containerRef.current.contains(
                    event.target as Node,
                )
            ) {
                setOpen(false);
            }
        }

        function handleKey(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                setOpen(false);
            }
        }

        document.addEventListener(
            'mousedown',
            handleClick,
        );
        document.addEventListener('keydown', handleKey);

        return () => {
            document.removeEventListener(
                'mousedown',
                handleClick,
            );
            document.removeEventListener(
                'keydown',
                handleKey,
            );
        };
    }, [open]);

    // Marquer comme lues à l'ouverture.
    function handleToggle() {
        const next = !open;
        setOpen(next);

        if (next) {
            setUnread(0);

            try {
                localStorage.setItem(
                    SEEN_KEY,
                    String(Date.now()),
                );
            } catch {
                // Stockage indisponible.
            }
        }
    }

    const preview = items.slice(0, 6);

    return (
        <div
            className={styles.wrapper}
            ref={containerRef}
        >
            <button
                type="button"
                className={styles.button}
                onClick={handleToggle}
                aria-label="Notifications"
                aria-expanded={open}
            >
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
                    <path d="M18 8.5a6 6 0 0 0-12 0c0 6-2.5 7.5-2.5 7.5h17S18 14.5 18 8.5z" />
                    <path d="M13.7 20a2 2 0 0 1-3.4 0" />
                </svg>

                {mounted && unread > 0 && (
                    <span className={styles.badge}>
                        {unread > 9 ? '9+' : unread}
                    </span>
                )}
            </button>

            {open && (
                <div className={styles.panel}>
                    <div className={styles.panelHeader}>
                        <strong>Notifications</strong>
                        <span>Latest additions</span>
                    </div>

                    {preview.length === 0 ? (
                        <p className={styles.empty}>
                            No notifications yet.
                        </p>
                    ) : (
                        <ul className={styles.list}>
                            {preview.map((item) => (
                                <li key={item.id}>
                                    <Link
                                        href="/vehicles"
                                        className={styles.item}
                                        onClick={() =>
                                            setOpen(false)
                                        }
                                    >
                                        <span
                                            className={[
                                                styles.dot,
                                                styles[item.type] ??
                                                    '',
                                            ].join(' ')}
                                        />

                                        <span
                                            className={
                                                styles.itemBody
                                            }
                                        >
                                            <span
                                                className={
                                                    styles.itemTitle
                                                }
                                            >
                                                {item.title}
                                            </span>

                                            {item.message && (
                                                <span
                                                    className={
                                                        styles.itemMessage
                                                    }
                                                >
                                                    {item.message}
                                                </span>
                                            )}
                                        </span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}

                    <Link
                        href="/notifications"
                        className={styles.viewAll}
                        onClick={() => setOpen(false)}
                    >
                        View all notifications
                    </Link>
                </div>
            )}
        </div>
    );
}
