'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { InboxNotice } from '@/lib/inbox-types';
import { notifyInboxChanged } from '@/lib/inbox-types';
import styles from './notification-bell.module.css';

// Centre privé : le compteur provient de PostgreSQL, jamais de localStorage.
export default function NotificationBell({ admin = false }: { admin?: boolean }) {
  const [items, setItems] = useState<InboxNotice[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const destination = admin ? '/admin/notifications' : '/notifications';

  const load = useCallback(async () => {
    try {
      const [list, count] = await Promise.all([
        fetch('/api/notifications/inbox?unread=true', { cache: 'no-store' }),
        fetch('/api/notifications/inbox/unread-count', { cache: 'no-store' }),
      ]);
      if (list.ok && count.ok) {
        setItems((await list.json()) as InboxNotice[]);
        const data = (await count.json()) as { count: number };
        setUnread(data.count);
      } else if (list.status === 401) { setItems([]); setUnread(0); }
    } catch { /* Le site reste utilisable si le serveur est temporairement indisponible. */ }
  }, []);

  useEffect(() => {
    const initialize = async () => { await load(); };
    void initialize();

    // Filet de sécurité : si les Server-Sent Events sont indisponibles
    // (proxy, réseau), un rafraîchissement périodique plus lent garde
    // le compteur exact. Le temps réel ci-dessous rend ce délai rare.
    const timer = window.setInterval(() => { void load(); }, 60000);
    window.addEventListener('luxury-inbox-changed', load);

    // Diffusion temps réel : le serveur pousse chaque nouvelle
    // notification dès son commit. L'identité vient du cookie JWT.
    let source: EventSource | null = null;
    if (typeof window !== 'undefined' && 'EventSource' in window) {
      source = new EventSource('/api/notifications/inbox/stream');
      source.onmessage = () => { void load(); };
      // En cas d'erreur, EventSource retente automatiquement :
      // aucune action nécessaire, le filet de sécurité prend le relais.
    }

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('luxury-inbox-changed', load);
      source?.close();
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    function close(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    function escape(event: KeyboardEvent) { if (event.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', escape); };
  }, [open]);

  async function markRead(id: string) {
    try {
      const result = await fetch(`/api/notifications/inbox/${id}/read`, { method: 'PATCH' });
      if (result.ok) notifyInboxChanged();
    } catch { /* L'utilisateur peut toujours consulter le détail. */ }
    setOpen(false);
  }

  async function readAll() {
    try {
      const result = await fetch('/api/notifications/inbox/read-all', { method: 'PATCH' });
      if (result.ok) notifyInboxChanged();
    } catch { /* Rattrapage au prochain rafraîchissement. */ }
  }

  return <div className={styles.wrapper} ref={containerRef}>
    <button type="button" className={styles.button} onClick={() => setOpen(value => !value)}
      aria-label={`Notifications (${unread} unread)`} aria-expanded={open} aria-haspopup="true">
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor"
        strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8.5a6 6 0 0 0-12 0c0 6-2.5 7.5-2.5 7.5h17S18 14.5 18 8.5z" />
        <path d="M13.7 20a2 2 0 0 1-3.4 0" />
      </svg>
      {unread > 0 && <span className={styles.badge}>{unread > 9 ? '9+' : unread}</span>}
    </button>
    {open && <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <strong>Notifications</strong>
        <button type="button" onClick={() => void readAll()} className={styles.markAll}>Mark all as read</button>
      </div>
      {items.length === 0 ? <p className={styles.empty}>You&apos;re all caught up.</p>
        : <ul className={styles.list}>{items.slice(0, 6).map(item =>
          <li key={item.id}><Link href={item.actionUrl ?? destination} className={styles.item}
            onClick={() => { void markRead(item.id); }}>
            <span className={styles.dot} />
            <span className={styles.itemBody}>
              <span className={styles.itemTitle}>{item.title}</span>
              <span className={styles.itemMessage}>{item.message}</span>
            </span>
          </Link></li>)}</ul>}
      <Link href={destination} className={styles.viewAll} onClick={() => setOpen(false)}>View notification centre →</Link>
    </div>}
  </div>;
}
