'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import styles from './rentals.module.css';
import { useConfirm } from '@/components/confirm-dialog';
import { useToast } from '@/components/toast';

interface Reservation {
  id: string;
  reservationNumber: string;
  status: string;
  pickupAt: string;
  returnAt: string;
  vehicleId: string;
  customerId: string;
}
interface RentalExtension {
  id: string;
  oldReturnAt: string;
  newReturnAt: string;
  additionalAmount: string;
  reason: string | null;
  createdAt: string;
}
interface Rental {
  id: string;
  contractNumber: string;
  reservationNumber: string;
  customerName: string;
  vehicleName: string;
  licensePlate: string;
  status: string;
  startedAt: string;
  expectedReturnAt: string;
  pickupMileageKm: number | null;
  pickupFuelLevelPct: number | null;
  pickupCondition: string | null;
  notes: string | null;
  isOverdue: boolean;
  extensions?: RentalExtension[];
}
interface ApiError { message?: string | string[] }

async function messageOf(response: Response): Promise<string> {
  try {
    const error: ApiError = await response.json();
    return Array.isArray(error.message) ? error.message.join(', ') : error.message || `HTTP ${response.status}`;
  } catch { return `HTTP ${response.status}`; }
}

function date(value: string) {
  return new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

const STATUS_CLASS: Record<string, string> = {
  active: styles.statusActive,
  returned: styles.statusReturned,
  closed: styles.statusClosed,
  overdue: styles.statusOverdue,
};

function statusClass(status: string, overdue: boolean): string {
  return STATUS_CLASS[overdue ? 'overdue' : status] ?? styles.statusClosed;
}

export default function AdminRentalsPage() {
  const confirm = useConfirm();
  const toast = useToast();
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reservationNumber, setReservationNumber] = useState('');
  const [mileageKm, setMileageKm] = useState('');
  const [fuelLevelPct, setFuelLevelPct] = useState('100');
  const [overallCondition, setOverallCondition] = useState('good');
  const [notes, setNotes] = useState('');
  const [extensionId, setExtensionId] = useState<string | null>(null);
  const [newReturnDate, setNewReturnDate] = useState('');
  const [extensionReason, setExtensionReason] = useState('');
  const [extending, setExtending] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  async function refresh() {
    const [rentalResponse, reservationResponse] = await Promise.all([
      fetch('/api/admin/rentals', { cache: 'no-store' }),
      fetch('/api/admin/reservations', { cache: 'no-store' }),
    ]);
    if (!rentalResponse.ok) throw new Error(await messageOf(rentalResponse));
    if (!reservationResponse.ok) throw new Error(await messageOf(reservationResponse));
    const rentalData: unknown = await rentalResponse.json();
    const reservationData: unknown = await reservationResponse.json();
    if (!Array.isArray(rentalData) || !Array.isArray(reservationData)) {
      throw new Error('Invalid response from the server.');
    }
    setRentals(rentalData as Rental[]);
    setReservations(reservationData as Reservation[]);
  }

  useEffect(() => {
    let cancelled = false;
    const initialize = async () => {
      try { await refresh(); }
      catch (cause) { if (!cancelled) setError(cause instanceof Error ? cause.message : 'Unable to load rentals.'); }
      finally { if (!cancelled) setLoading(false); }
    };
    void initialize();
    return () => { cancelled = true; };
  }, []);

  // Réévalue régulièrement la fenêtre de remise, sans lire l'horloge pendant le rendu.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const confirmed = useMemo(() => reservations.filter((r) => r.status === 'confirmed'), [reservations]);
  // Une réservation future ou déjà expirée ne doit pas être proposée à la remise.
  const readyForHandover = confirmed.filter((r) => {
    const pickup = Date.parse(r.pickupAt);
    const returned = Date.parse(r.returnAt);
    return Number.isFinite(pickup) && Number.isFinite(returned) && pickup <= now && now < returned;
  });
  // Le retard est un indicateur, pas un nouveau statut de location.
  const summary = useMemo(() => ({
    total: rentals.length,
    active: rentals.filter((r) => r.status === 'active').length,
    overdue: rentals.filter((r) => r.status === 'active' && r.isOverdue).length,
    finished: rentals.filter((r) => r.status === 'returned' || r.status === 'closed').length,
  }), [rentals]);

  const visible = useMemo(() => rentals.filter((r) => {
    const matchesText = `${r.contractNumber} ${r.reservationNumber} ${r.customerName} ${r.vehicleName} ${r.licensePlate}`
      .toLowerCase().includes(search.trim().toLowerCase());
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'overdue'
        ? r.status === 'active' && r.isOverdue
        : r.status === statusFilter);
    return matchesText && matchesStatus;
  }), [rentals, search, statusFilter]);

  async function startRental(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    if (!reservationNumber) { setError('Select a confirmed reservation.'); return; }
    const approved = await confirm({
      title: 'Start rental',
      message: `Start the rental for ${reservationNumber}? This records the vehicle handover.`,
      confirmLabel: 'Start rental',
      tone: 'success',
    });
    if (!approved) return;
    setSaving(true); setError(''); setSuccess('');
    try {
      const response = await fetch('/api/admin/rentals', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reservationNumber, mileageKm: Number(mileageKm),
          fuelLevelPct: Number(fuelLevelPct), overallCondition, notes,
        }),
      });
      if (!response.ok) throw new Error(await messageOf(response));
      const rental: Rental = await response.json();
      await refresh();
      const outcome = `Rental ${rental.contractNumber} started successfully.`;
      setSuccess(outcome);
      toast.success(outcome, 'Rental started');
      setReservationNumber(''); setMileageKm(''); setFuelLevelPct('100');
      setOverallCondition('good'); setNotes('');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Unable to start rental.';
      setError(message);
      toast.error(message, 'Rental');
    } finally { setSaving(false); }
  }

  // Soumission d'une prolongation : seul le backend décide de la disponibilité.
  async function extendRental(event: FormEvent<HTMLFormElement>, rental: Rental) {
    event.preventDefault();
    if (extending || !newReturnDate) return;
    const approved = await confirm({
      title: 'Extend rental',
      message: `Extend rental ${rental.contractNumber} until ${newReturnDate}?`,
      confirmLabel: 'Extend rental',
      cancelLabel: 'Back',
    });
    if (!approved) return;
    setExtending(true); setError(''); setSuccess('');
    try {
      const newReturnAtIso = new Date(rental.expectedReturnAt).toISOString();
      const timeOfDay = newReturnAtIso.slice(11, 16);
      const response = await fetch(`/api/admin/rentals/${rental.id}/extend`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newReturnDate, newReturnTime: timeOfDay, reason: extensionReason }),
      });
      const result: { additionalDays: number; additionalAmount: string } = await response.json();
      await refresh();
      const outcome = `Rental ${rental.contractNumber} extended by ${result.additionalDays} day(s). Additional rental charge: ${result.additionalAmount}.`;
      setSuccess(outcome);
      toast.success(outcome, 'Rental extended');
      setExtensionId(null); setNewReturnDate(''); setExtensionReason('');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Unable to extend rental.';
      setError(message);
      toast.error(message, 'Rental');
    } finally { setExtending(false); }
  }

  function toggleExtension(rental: Rental) {
    if (extensionId === rental.id) { setExtensionId(null); return; }
    setExtensionId(rental.id);
    setNewReturnDate(new Date(new Date(rental.expectedReturnAt).getTime() + 86_400_000).toISOString().slice(0, 10));
    setExtensionReason('');
  }

  return <main className={styles.page}>
    <Link href="/admin" className={styles.back}>← Back to dashboard</Link>
    <header className={styles.hero}>
      <p className={styles.eyebrow}>ADMINISTRATOR MANAGEMENT</p>
      <h1>Rental management</h1>
      <p className={styles.intro}>Start rentals from confirmed reservations, monitor active rentals and extend return dates when the vehicle remains available.</p>
    </header>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {success && <p className={styles.success} role="status">{success}</p>}

    <section className={styles.panel}>
      <h2>Vehicle handover</h2>
      <p>Select a confirmed reservation. The vehicle and customer are inherited from that reservation.</p>
      <form onSubmit={(event) => void startRental(event)} className={styles.form}>
        <label className={styles.wide}>Confirmed reservation
          <select required value={reservationNumber} disabled={loading || saving}
            onChange={(e) => setReservationNumber(e.target.value)}>
            <option value="">Select a reservation</option>
            {readyForHandover.map((r) => <option value={r.reservationNumber} key={r.id}>
              {r.reservationNumber} — pickup {r.pickupAt.slice(0,10)} — return {r.returnAt.slice(0,10)}
            </option>)}
          </select>
        </label>
        <label>Pickup mileage (km)
          <input type="number" min="0" max="999999999" required value={mileageKm}
            onChange={(e) => setMileageKm(e.target.value)} disabled={saving} />
        </label>
        <label>Fuel level (%)
          <input type="number" min="0" max="100" required value={fuelLevelPct}
            onChange={(e) => setFuelLevelPct(e.target.value)} disabled={saving} />
        </label>
        <label>Vehicle condition
          <select value={overallCondition} onChange={(e) => setOverallCondition(e.target.value)} disabled={saving}>
            <option value="excellent">Excellent</option><option value="good">Good</option>
            <option value="fair">Fair</option><option value="damaged">Damaged</option>
          </select>
        </label>
        <label className={styles.wide}>Handover notes (optional)
          <textarea maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={saving} />
        </label>
        <button type="submit" disabled={saving || loading || !reservationNumber}>
          {saving ? 'Starting rental…' : 'Start rental'}
        </button>
      </form>
      {!loading && readyForHandover.length === 0 && <p className={styles.hint}>
        {confirmed.length === 0
          ? 'No confirmed reservations available for handover.'
          : 'No confirmed reservations are within their scheduled pickup and return window.'}
      </p>}
      <p className={styles.hint}>For safety, handover is permitted only between the scheduled pickup and return dates.</p>
    </section>

    <section className={styles.list}>
      <div className={styles.listHeader}>
        <h2>Rental monitoring</h2><span className={styles.count}>{visible.length} records</span>
      </div>
      <div className={styles.stats} aria-label="Rental overview">
        <div><span>All rentals</span><strong>{summary.total}</strong></div>
        <div><span>Active</span><strong>{summary.active}</strong></div>
        <div><span>Overdue</span><strong>{summary.overdue}</strong></div>
        <div><span>Returned / Closed</span><strong>{summary.finished}</strong></div>
      </div>
      <div className={styles.toolbar}>
        <label className={styles.search}>Search rentals
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Contract, customer or vehicle" />
        </label>
        <label className={styles.search}>Rental status
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="overdue">Overdue</option>
            <option value="returned">Returned</option>
            <option value="closed">Closed</option>
          </select>
        </label>
        <button type="button" className={styles.refresh} onClick={() => void refresh().catch((e: unknown) => setError(e instanceof Error ? e.message : 'Unable to refresh.'))}>
          Refresh
        </button>
      </div>
      {loading ? <p>Loading rentals...</p> : visible.length === 0 ? <p>No rentals found.</p> :
        <div className={styles.grid}>{visible.map((r) => <article className={styles.card} key={r.id}>
          <div className={styles.cardHead}><strong>{r.contractNumber}</strong>
            <span className={`${styles.status} ${statusClass(r.status, r.status === 'active' && r.isOverdue)}`}>
              {r.status === 'active' && r.isOverdue ? 'Overdue' : r.status}
            </span>
          </div>
          <h3>{r.vehicleName}</h3><p>{r.licensePlate}</p>
          <dl>
            <div><dt>Customer</dt><dd>{r.customerName}</dd></div>
            <div><dt>Reservation</dt><dd>{r.reservationNumber}</dd></div>
            <div><dt>Pickup</dt><dd>{date(r.startedAt)}</dd></div>
            <div><dt>Expected return</dt><dd>{date(r.expectedReturnAt)}</dd></div>
            <div><dt>Handover mileage</dt><dd>{r.pickupMileageKm ?? '—'} km</dd></div>
            <div><dt>Fuel</dt><dd>{r.pickupFuelLevelPct ?? '—'}%</dd></div>
            <div><dt>Condition</dt><dd>{r.pickupCondition ?? '—'}</dd></div>
          </dl>
          {r.status === 'active' && r.isOverdue &&
            <p className={styles.warning}>This rental has passed its scheduled return date. Return processing will be added in Copy 7.</p>}
          <button type="button" className={styles.detailsButton}
            aria-expanded={expandedId === r.id}
            onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}>
            {expandedId === r.id ? 'Hide details' : 'View rental details'}
          </button>
          {expandedId === r.id && <div className={styles.expanded}>
            <dl>
              <div><dt>Contract number</dt><dd>{r.contractNumber}</dd></div>
              <div><dt>Rental status</dt><dd>{r.status}</dd></div>
              <div><dt>Customer</dt><dd>{r.customerName}</dd></div>
              <div><dt>Reservation</dt><dd>{r.reservationNumber}</dd></div>
              <div><dt>Vehicle</dt><dd>{r.vehicleName} — {r.licensePlate}</dd></div>
              <div><dt>Started</dt><dd>{date(r.startedAt)}</dd></div>
              <div><dt>Scheduled return</dt><dd>{date(r.expectedReturnAt)}</dd></div>
              <div><dt>Vehicle condition at pickup</dt><dd>{r.pickupCondition ?? '—'}</dd></div>
              <div><dt>Pickup mileage</dt><dd>{r.pickupMileageKm ?? '—'} km</dd></div>
              <div><dt>Fuel at pickup</dt><dd>{r.pickupFuelLevelPct ?? '—'}%</dd></div>
            </dl>
            {r.notes && <p className={styles.cardNotes}>Handover notes: {r.notes}</p>}
            {r.extensions && r.extensions.length > 0 && <div className={styles.extensionHistory}>
              <h4>Extension history</h4>
              {r.extensions.map((extension) => <p key={extension.id}>
                {date(extension.oldReturnAt)} → {date(extension.newReturnAt)}
                {' · '}Additional charge: {extension.additionalAmount}
                {extension.reason ? ` · ${extension.reason}` : ''}
              </p>)}
            </div>}
          </div>}
          {r.status === 'active' && <div className={styles.extensionSection}>
            <button type="button" className={styles.detailsButton}
              disabled={extending || saving}
              aria-expanded={extensionId === r.id}
              onClick={() => toggleExtension(r)}>
              {extensionId === r.id ? 'Cancel extension' : 'Extend rental'}
            </button>
            {extensionId === r.id && <form className={styles.extensionForm}
              onSubmit={(event) => void extendRental(event, r)}>
              <p>Current return: {date(r.expectedReturnAt)}</p>
              <label>New return date (UTC)
                <input type="date" required value={newReturnDate}
                  min={new Date(new Date(r.expectedReturnAt).getTime() + 86_400_000).toISOString().slice(0, 10)}
                  onChange={(event) => setNewReturnDate(event.target.value)} disabled={extending} />
              </label>
              <label>Reason (optional)
                <textarea value={extensionReason} maxLength={500}
                  onChange={(event) => setExtensionReason(event.target.value)} disabled={extending} />
              </label>
              <button type="submit" disabled={extending || !newReturnDate}>
                {extending ? 'Checking availability…' : 'Confirm extension'}
              </button>
              <p>Availability and additional rental charges will be verified on the server.</p>
            </form>}
          </div>}
        </article>)}</div>}
    </section>
  </main>;
}
