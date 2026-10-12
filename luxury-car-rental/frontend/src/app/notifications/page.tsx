'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import type {
  NotificationItem,
} from '@/lib/catalog-types';

import styles from './notifications.module.css';

// ==========================================================
// PAGE PUBLIQUE — NOTIFICATIONS
// ==========================================================
//
// Liste l'ensemble des nouveautés du catalogue :
// nouvelles voitures, éditions spéciales et limitées.
// ==========================================================

const LABELS: Record<string, string> = {
  new_vehicle: 'New arrival',
  special_edition: 'Special edition',
  limited_edition: 'Limited edition',
  general: 'News',
};

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [needsAuth, setNeedsAuth] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response = await fetch('/api/notifications', {
          cache: 'no-store',
        });

        if (!active) {
          return;
        }

        // Le flux est réservé aux utilisateurs connectés.
        if (response.status === 401) {
          setNeedsAuth(true);
          return;
        }

        if (!response.ok) {
          setError('Unable to load notifications.');
          return;
        }

        const data =
          (await response.json()) as NotificationItem[];

        setItems(data);
      } catch {
        if (active) {
          setError('Unable to load notifications.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>
            The Collection
          </p>

          <h1>Notifications</h1>

          <p className={styles.lead}>
            New arrivals, special editions and limited
            series as they join the Luxury Cars fleet.
          </p>
        </header>

        {loading && (
          <p className={styles.state}>
            Loading notifications…
          </p>
        )}

        {!loading && needsAuth && (
          <div className={styles.state}>
            <p>
              Notifications are available to signed-in
              members. Please sign in to follow the newest
              arrivals.
            </p>

            <Link href="/login" className={styles.link}>
              Sign in →
            </Link>
          </div>
        )}

        {!loading && !needsAuth && error && (
          <p className={styles.state}>{error}</p>
        )}

        {!loading && !needsAuth && !error && items.length === 0 && (
          <p className={styles.state}>
            No notifications yet. Please check back soon.
          </p>
        )}

        {!loading && !needsAuth && !error && items.length > 0 && (
          <ul className={styles.list}>
            {items.map((item) => (
              <li key={item.id} className={styles.card}>
                <div className={styles.cardTop}>
                  <span
                    className={[
                      styles.badge,
                      styles[item.type] ?? '',
                    ].join(' ')}
                  >
                    {LABELS[item.type] ?? 'News'}
                  </span>

                  <time className={styles.date}>
                    {formatDate(item.createdAt)}
                  </time>
                </div>

                <h2 className={styles.title}>
                  {item.title}
                </h2>

                {item.message && (
                  <p className={styles.message}>
                    {item.message}
                  </p>
                )}

                {(item.brandName || item.categoryName) && (
                  <p className={styles.meta}>
                    {item.categoryName}
                    {item.categoryName && item.brandName
                      ? ' · '
                      : ''}
                    {item.brandName}
                    {item.isLimited &&
                    item.editionSize !== null
                      ? ` · ${item.editionSize} units`
                      : ''}
                  </p>
                )}

                <Link
                  href="/vehicles"
                  className={styles.link}
                >
                  View in fleet →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
