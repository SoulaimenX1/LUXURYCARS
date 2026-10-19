'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './rentals.module.css';

// Informations publiques à un client concernant ses propres locations.
interface RentalExtension {
  id: string;
  oldReturnAt: string;
  newReturnAt: string;
  createdAt: string;
}
interface CustomerRental {
  id: string;
  contractNumber: string;
  reservationNumber: string;
  vehicleId: string;
  vehicleName: string;
  licensePlate: string;
  status: 'active' | 'returned' | 'closed';
  startedAt: string;
  expectedReturnAt: string;
  returnedAt: string | null;
  pickupMileageKm: number | null;
  pickupFuelLevelPct: number | null;
  pickupCondition: string | null;
  isOverdue: boolean;
  extensions?: RentalExtension[];
}

type Filter = 'all' | 'active' | 'overdue' | 'history';

function isCustomerRental(value: unknown): value is CustomerRental {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Partial<CustomerRental>;
  return typeof item.id === 'string' &&
    typeof item.contractNumber === 'string' &&
    typeof item.reservationNumber === 'string' &&
    typeof item.vehicleName === 'string' &&
    typeof item.status === 'string' &&
    ['active', 'returned', 'closed'].includes(item.status) &&
    typeof item.startedAt === 'string' &&
    typeof item.expectedReturnAt === 'string' &&
    typeof item.isOverdue === 'boolean';
}

function date(value: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString('en-GB', {
    dateStyle: 'medium', timeStyle: 'short',
  });
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const data: unknown = await response.json();
    if (data && typeof data === 'object' && 'message' in data) {
      const message = (data as { message: unknown }).message;
      if (typeof message === 'string') return message;
    }
  } catch {
    // Conserver le code HTTP lorsque le serveur ne retourne pas de JSON.
  }
  return `Unable to load rentals (HTTP ${response.status}).`;
}

export default function MyRentalsPage() {
  const router = useRouter();
  const [rentals, setRentals] = useState<CustomerRental[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [detailsId, setDetailsId] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/rentals/me', {
        cache: 'no-store', signal,
      });
      if (response.status === 401) {
        router.replace('/login');
        return;
      }
      if (response.status === 403) {
        router.replace('/account');
        return;
      }
      if (!response.ok) throw new Error(await errorMessage(response));
      const result: unknown = await response.json();
      if (!Array.isArray(result) || !result.every(isCustomerRental)) {
        throw new Error('Invalid rental history received.');
      }
      if (!signal?.aborted) setRentals(result);
    } catch (cause) {
      if (!signal?.aborted) {
        setError(cause instanceof Error ? cause.message : 'Unable to load rentals.');
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const controller = new AbortController();
    const initialize = async () => { await load(controller.signal); };
    void initialize();
    return () => controller.abort();
  }, [load]);

  const visible = useMemo(() => rentals.filter((r) => {
    if (filter === 'active') return r.status === 'active';
    if (filter === 'overdue') return r.status === 'active' && r.isOverdue;
    if (filter === 'history') return r.status !== 'active';
    return true;
  }), [filter, rentals]);

  return <main className={styles.page}>
    <div className={styles.container}>
      <Link className={styles.back} href="/account">← Back to my account</Link>
      <p className={styles.eyebrow}>YOUR RENTAL JOURNEY</p>
      <h1>My rentals</h1>
      <p className={styles.intro}>Track your current vehicle rental, review pickup information and explore your history.</p>

      <div className={styles.toolbar}>
        <label htmlFor="rental-filter">Show rentals</label>
        <select id="rental-filter" value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
          <option value="all">All rentals</option>
          <option value="active">Active</option>
          <option value="overdue">Overdue</option>
          <option value="history">Returned / Closed</option>
        </select>
        <button type="button" disabled={loading} onClick={() => void load()}>
          Refresh
        </button>
      </div>

      {error && <p role="alert" className={styles.error}>{error}</p>}
      {loading ? <p className={styles.empty}>Loading your rentals…</p> :
        visible.length === 0 ? <div className={styles.empty}>
          <p>{rentals.length === 0 ? 'You do not have any rentals yet.' : 'No rentals match this filter.'}</p>
          <Link href="/account/reservations">View my reservations →</Link>
        </div> :
        <div className={styles.list}>
          {visible.map((r) => <article className={styles.card} key={r.id}>
            <div className={styles.cardHead}>
              <div><span className={styles.eyebrow}>CONTRACT</span><h2>{r.contractNumber}</h2></div>
              <span className={r.status === 'active' && r.isOverdue ? styles.overdue : styles.status}>
                {r.status === 'active' && r.isOverdue ? 'Overdue' : r.status}
              </span>
            </div>
            <h3>{r.vehicleName}</h3>
            <p className={styles.plate}>Plate: {r.licensePlate}</p>
            <dl className={styles.details}>
              <div><dt>Pickup</dt><dd>{date(r.startedAt)}</dd></div>
              <div><dt>Expected return</dt><dd>{date(r.expectedReturnAt)}</dd></div>
              <div><dt>Actual return</dt><dd>{date(r.returnedAt)}</dd></div>
              <div><dt>Reservation</dt><dd>{r.reservationNumber}</dd></div>
            </dl>
            {r.status === 'active' && r.isOverdue &&
              <p className={styles.warning}>The scheduled return date has passed. Please contact the rental company.</p>}
            <button type="button" className={styles.expand} aria-expanded={detailsId === r.id}
              onClick={() => setDetailsId(detailsId === r.id ? null : r.id)}>
              {detailsId === r.id ? 'Hide rental details' : 'View rental details'}
            </button>
            <div className={styles.documentLinks}>
              <a href={`/api/finance/me/${r.id}/documents/contract`} target="_blank" rel="noopener noreferrer">Rental contract PDF</a>
              {r.status!=='active'&&<a href={`/api/finance/me/${r.id}/documents/invoice`} target="_blank" rel="noopener noreferrer">Invoice PDF (if issued)</a>}
            </div>
            {detailsId === r.id && <div>
              <dl className={styles.details}>
                <div><dt>Pickup mileage</dt><dd>{r.pickupMileageKm ?? '—'} km</dd></div>
                <div><dt>Fuel level</dt><dd>{r.pickupFuelLevelPct ?? '—'}%</dd></div>
                <div><dt>Condition at pickup</dt><dd>{r.pickupCondition ?? '—'}</dd></div>
              </dl>
              {!!r.extensions?.length && <div className={styles.extensionHistory}>
                <strong>Approved extensions</strong>
                {r.extensions.map((extension) => <p key={extension.id}>
                  {date(extension.oldReturnAt)} → {date(extension.newReturnAt)}
                </p>)}
              </div>}
            </div>}
          </article>)}
        </div>}
    </div>
  </main>;
}
