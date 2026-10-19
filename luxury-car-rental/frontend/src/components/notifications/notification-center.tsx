'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { InboxNotice, InboxCategory, InboxPreferences } from '@/lib/inbox-types';
import { notifyInboxChanged } from '@/lib/inbox-types';
import type { NotificationItem } from '@/lib/catalog-types';
import { useToast } from '@/components/toast';
import styles from '@/app/notifications/notifications.module.css';

type View = 'all' | 'unread' | 'announcements' | InboxCategory;
const tabs: { key: View; label: string }[] = [
  { key: 'all', label: 'All' }, { key: 'unread', label: 'Unread' },
  { key: 'reservations', label: 'Bookings' }, { key: 'rentals', label: 'Rentals' },
  { key: 'payments', label: 'Payments' }, { key: 'security', label: 'Security' },
  { key: 'fleet', label: 'Fleet' }, { key: 'announcements', label: 'Fleet news archive' },
];

export default function NotificationCenter({ variant = 'default' }: { variant?: 'default' | 'admin' } = {}) {
  const [view, setView] = useState<View>('all');
  const [items, setItems] = useState<InboxNotice[]>([]);
  const [announcements, setAnnouncements] = useState<NotificationItem[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [authRequired, setAuthRequired] = useState(false);
  const [preferences, setPreferences] = useState<InboxPreferences | null>(null);
  const [showPreferences, setShowPreferences] = useState(false);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      if (view === 'announcements') {
        const response = await fetch('/api/notifications', { cache:'no-store' });
        if (response.status === 401) { setAuthRequired(true); return; }
        if (!response.ok) throw new Error('Unavailable');
        setAnnouncements((await response.json()) as NotificationItem[]);
        setAuthRequired(false);
        return;
      }
      const query = new URLSearchParams({
        category: view === 'unread' ? 'all' : view,
        unread: String(view === 'unread'), page: String(page),
      });
      const response = await fetch(`/api/notifications/inbox?${query}`, { cache:'no-store' });
      if (response.status === 401) { setAuthRequired(true); setItems([]); return; }
      if (!response.ok) throw new Error('Unable to load your notifications.');
      setAuthRequired(false);
      setItems((await response.json()) as InboxNotice[]);
    } catch { setError('Unable to load your notifications.'); }
    finally { setLoading(false); }
  }, [view, page]);

  useEffect(() => { const initialize = async () => { await load(); }; void initialize(); }, [load]);
  useEffect(() => {
    if (!showPreferences) return;
    void fetch('/api/notifications/inbox/preferences', { cache: 'no-store' })
      .then(r => r.ok ? r.json() as Promise<InboxPreferences> : Promise.reject())
      .then(setPreferences).catch(() => setError('Unable to load preferences.'));
  }, [showPreferences]);

  async function update(id: string, action: 'read' | 'archive') {
    try {
      const response = await fetch(`/api/notifications/inbox/${id}/${action}`, { method: 'PATCH' });
      if (!response.ok) throw new Error();
      notifyInboxChanged();
      await load();
      toast.success('Notification updated.', 'Notification centre');
    } catch {
      setError('Could not update notification.');
      toast.error('Could not update notification.', 'Notification centre');
    }
  }
  async function readAll() {
    try {
      const result = await fetch('/api/notifications/inbox/read-all', { method:'PATCH' });
      if (!result.ok) throw new Error();
      notifyInboxChanged(); await load();
      toast.success('All notifications marked as read.', 'Notification centre');
    } catch {
      setError('Could not mark all notifications as read.');
      toast.error('Could not mark all notifications as read.', 'Notification centre');
    }
  }
  async function savePreferences() {
    if (!preferences) return;
    setSaving(true);
    try {
      const result = await fetch('/api/notifications/inbox/preferences', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(preferences),
      });
      if (!result.ok) throw new Error();
      setShowPreferences(false); setError('');
      toast.success('Preferences saved.', 'Notification centre');
    } catch {
      setError('Unable to save preferences.');
      toast.error('Unable to save preferences.', 'Notification centre');
    }
    finally { setSaving(false); }
  }

  return <main className={styles.page} data-variant={variant}><div className={styles.container}>
    <header className={styles.header}>
      <p className={styles.eyebrow}>Private Concierge</p>
      <h1>Notification Centre</h1>
      <p className={styles.lead}>Your reservations, rental reminders and important updates, all in one place.</p>
    </header>
    <div className={styles.toolbar}>
      <button type="button" onClick={() => void readAll()}>Mark all as read</button>
      <button type="button" onClick={() => setShowPreferences(value => !value)}>Preferences</button>
    </div>
    {showPreferences && <section className={styles.preferences} aria-label="Notification preferences">
      <h2>Notification preferences</h2>
      {preferences ? <>
        {([
          ['bookingUpdates','Booking updates'], ['rentalReminders','Pick-up and drop-off reminders'],
          ['fleetNews','Fleet announcements'], ['emailEnabled','Email notifications (not yet connected)'],
        ] as const).map(([key,label]) => <label key={key}>
          <input type="checkbox" checked={preferences[key]} disabled={key === 'emailEnabled'}
            onChange={e => setPreferences({ ...preferences, [key]: e.target.checked })} /> {label}
        </label>)}
        <button type="button" disabled={saving} onClick={() => void savePreferences()}>Save preferences</button>
      </> : <p>Loading preferences…</p>}
    </section>}
    <div className={styles.filters} role="group" aria-label="Filter notifications">
      {tabs.map(tab => <button key={tab.key} type="button" className={view === tab.key ? styles.selected : ''}
        onClick={() => { setView(tab.key); setPage(0); }}>{tab.label}</button>)}
    </div>
    {authRequired && <p className={styles.state}>Please <Link href="/login">sign in</Link> to view your notifications.</p>}
    {error && <p role="alert" className={styles.state}>{error}</p>}
    {loading && !authRequired && <p className={styles.state}>Loading notifications…</p>}
    {!loading && !authRequired && view !== 'announcements' && items.length === 0 && <p className={styles.state}>No notifications for this filter.</p>}
    {!loading && !authRequired && view === 'announcements' && announcements.length === 0 && <p className={styles.state}>No fleet announcements yet.</p>}
    {!loading && !authRequired && view === 'announcements' && <ul className={styles.list}>{announcements.map(item =>
      <li key={item.id} className={styles.card}>
        <div className={styles.cardTop}><span className={styles.badge}>{item.type.replaceAll('_', ' ')}</span>
          <time className={styles.date}>{new Date(item.createdAt).toLocaleDateString('en-GB')}</time></div>
        <h2 className={styles.title}>{item.title}</h2>
        <p className={styles.message}>{item.message}</p>
        <Link href="/vehicles" className={styles.link}>View in fleet →</Link>
      </li>)}</ul>}
    {!loading && !authRequired && view !== 'announcements' && <ul className={styles.list}>{items.map(item =>
      <li key={item.id} className={`${styles.card} ${!item.readAt ? styles.unreadCard : ''}`}>
        <div className={styles.cardTop}>
          <span className={styles.badge}>{item.category} · {item.priority}</span>
          <time className={styles.date} dateTime={item.createdAt}>
            {new Date(item.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
          </time>
        </div>
        <h2 className={styles.title}>{item.title}</h2>
        <p className={styles.message}>{item.message}</p>
        <div className={styles.noticeActions}>
          {item.actionUrl && <Link href={item.actionUrl} className={styles.link} onClick={() => { void update(item.id,'read'); }}>View details →</Link>}
          {!item.readAt && <button type="button" onClick={() => void update(item.id,'read')}>Mark read</button>}
          <button type="button" onClick={() => void update(item.id,'archive')}>Archive</button>
        </div>
      </li>)}</ul>}
    {view !== 'announcements' && <div className={styles.pagination}>
      <button type="button" disabled={page === 0 || loading} onClick={() => setPage(p => Math.max(0,p-1))}>← Previous</button>
      <span>Page {page + 1}</span>
      <button type="button" disabled={items.length < 30 || loading} onClick={() => setPage(p => p+1)}>Next →</button>
    </div>}
  </div></main>;
}
