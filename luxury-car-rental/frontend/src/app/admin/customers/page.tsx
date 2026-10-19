'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { useConfirm } from '@/components/confirm-dialog';
import { useToast } from '@/components/toast';

import styles from './customers.module.css';

interface Reservation { id: string; reservationNumber: string; status: string; pickupAt: string; returnAt: string; totalAmount: string; }
interface Profile { licenseNumber: string; licenseCountry: string; licenseIssuedOn: string; licenseExpiresOn: string; city: string | null; country: string | null; }
interface Customer { id: string; firstName: string; lastName: string; email: string; phone: string | null; status: string; createdAt: string; profile: Profile | null; reservations: Reservation[]; }

const STATUS_CLASS: Record<string, string> = {
  active: styles.statusActive,
  confirmed: styles.statusConfirmed,
  completed: styles.statusConfirmed,
  returned: styles.statusConfirmed,
  invited: styles.statusPending,
  pending: styles.statusPending,
  suspended: styles.statusDanger,
  cancelled: styles.statusDanger,
  rejected: styles.statusDanger,
  expired: styles.statusNeutral,
  closed: styles.statusNeutral,
  converted: styles.statusNeutral,
};

function statusClass(status: string): string {
  return STATUS_CLASS[status] ?? styles.statusNeutral;
}

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const confirm = useConfirm();
  const toast = useToast();

  async function changeAccountStatus(customer: Customer, action: 'suspend' | 'reactivate') {
    const fullName = `${customer.firstName} ${customer.lastName}`;
    const confirmed = await confirm(
      action === 'suspend'
        ? {
            title: 'Suspend account',
            message:
              `Suspend ${fullName}? The customer will no longer be able to sign in or create ` +
              'reservations. Existing reservations and financial history are preserved.',
            confirmLabel: 'Suspend',
            tone: 'danger' as const,
          }
        : {
            title: 'Reactivate account',
            message:
              `Reactivate ${fullName}? The customer will be able to sign in and create ` +
              'reservations again. Existing history is preserved.',
            confirmLabel: 'Reactivate',
            tone: 'success' as const,
          },
    );
    if (!confirmed) return;
    setError('');
    setNotice('');
    setBusyId(customer.id);
    try {
      const response = await fetch(`/api/admin/customers/${customer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          (result as { message?: string | string[] } | null)?.message;
        throw new Error(
          Array.isArray(message) ? message.join(' ') : (message || 'Unable to update the account.'),
        );
      }
      const nextStatus = (result as { status?: string } | null)?.status ??
        (action === 'suspend' ? 'suspended' : 'active');
      setCustomers((current) =>
        current.map((item) => (item.id === customer.id ? { ...item, status: nextStatus } : item)),
      );
      const successMessage =
        action === 'suspend'
          ? `${fullName}'s account has been suspended.`
          : `${fullName}'s account has been reactivated.`;
      setNotice(successMessage);
      toast.success(successMessage, 'Customer account');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to update the customer account.';
      setError(message);
      toast.error(message, 'Customer account');
    } finally {
      setBusyId(null);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch('/api/admin/customers', { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error(`Unable to load customers (HTTP ${response.status}).`);
        const data: unknown = await response.json();
        if (!Array.isArray(data)) throw new Error('Invalid customer response.');
        if (!controller.signal.aborted) setCustomers(data as Customer[]);
      } catch (caught) {
        if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : 'Unable to load customers.');
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, []);

  const visible = useMemo(() => customers.filter((customer) => {
    const haystack = `${customer.firstName} ${customer.lastName} ${customer.email} ${customer.phone ?? ''}`.toLowerCase();
    return haystack.includes(search.trim().toLowerCase()) && (status === 'all' || customer.status === status);
  }), [customers, search, status]);
  const selected = customers.find((customer) => customer.id === selectedId);
  return <main className={styles.page}>
    <Link href="/admin" className={styles.back}>← Back to dashboard</Link>
    <header className={styles.hero}>
      <p className={styles.eyebrow}>ADMINISTRATOR MANAGEMENT</p>
      <h1>Customer management</h1>
      <p className={styles.intro}>Search customers, consult their profiles, driving licences and reservation history.</p>
    </header>
    <div className={styles.filters}>
      <label>Search<input placeholder="Name, email or phone" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
      <label>Account status<select value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="all">All accounts</option><option value="active">Active</option><option value="invited">Invited</option><option value="suspended">Suspended</option>
      </select></label><span className={styles.count}>{visible.length} customers</span>
    </div>
    {loading && <p role="status">Loading customers...</p>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    {notice && <p className={styles.notice} role="status">{notice}</p>}
    <div className={styles.layout}>
      <div className={styles.list}>{visible.map((customer) => <button key={customer.id} type="button"
        className={selectedId === customer.id ? styles.selected : styles.customer} onClick={() => setSelectedId(customer.id)}>
        <strong>{customer.firstName} {customer.lastName}</strong>
        <small>{customer.email}</small>
      </button>)}
      {!loading && visible.length === 0 && <p>No customers match the filters.</p>}</div>
      <article className={styles.detail}>
        {!selected && <p>Select a customer to view their information.</p>}
        {selected && <><p className={styles.eyebrow}>CUSTOMER PROFILE</p><h2>{selected.firstName} {selected.lastName}</h2>
          <dl className={styles.details}>
            <div><dt>Email</dt><dd>{selected.email}</dd></div><div><dt>Phone</dt><dd>{selected.phone || 'Not provided'}</dd></div>
            <div><dt>Account</dt><dd><span className={`${styles.status} ${statusClass(selected.status)}`}>{selected.status}</span></dd></div><div><dt>Registered</dt><dd>{selected.createdAt.slice(0,10)}</dd></div>
            <div><dt>Location</dt><dd>{[selected.profile?.city,selected.profile?.country].filter(Boolean).join(', ') || 'Not provided'}</dd></div>
          </dl>
          <div className={styles.accountActions}>
            <h3>Account management</h3>
            <p className={styles.accountHint}>
              Suspension blocks sign-in and new reservations only. Existing bookings and
              financial history are never altered or cancelled automatically.
            </p>
            <div className={styles.actionRow}>
              {selected.status === 'suspended' ? (
                <button type="button" className={styles.primaryAction}
                  disabled={busyId === selected.id}
                  onClick={() => changeAccountStatus(selected, 'reactivate')}>
                  {busyId === selected.id ? 'Updating...' : 'Reactivate account'}
                </button>
              ) : (
                <button type="button" className={styles.dangerAction}
                  disabled={busyId === selected.id}
                  onClick={() => changeAccountStatus(selected, 'suspend')}>
                  {busyId === selected.id ? 'Updating...' : 'Suspend account'}
                </button>
              )}
            </div>
          </div>
          <h3>Driving licence information</h3>
          {selected.profile ? <dl className={styles.details}>
            <div><dt>Number</dt><dd>{selected.profile.licenseNumber}</dd></div>
            <div><dt>Country</dt><dd>{selected.profile.licenseCountry}</dd></div>
            <div><dt>Issued</dt><dd>{selected.profile.licenseIssuedOn}</dd></div>
            <div><dt>Expires</dt><dd>{selected.profile.licenseExpiresOn}</dd></div>
          </dl> : <p>Customer profile incomplete.</p>}
          <h3>Reservation history ({selected.reservations.length})</h3>
          <div className={styles.history}>{selected.reservations.map((r) => <div key={r.id} className={styles.historyRow}>
            <strong>{r.reservationNumber}</strong><span className={`${styles.status} ${statusClass(r.status)}`}>{r.status}</span>
            <small>{r.pickupAt.slice(0,10)} → {r.returnAt.slice(0,10)} · {r.totalAmount}</small>
          </div>)}{!selected.reservations.length && <p>No reservations yet.</p>}</div>
        </>}
      </article>
    </div>
  </main>;
}
