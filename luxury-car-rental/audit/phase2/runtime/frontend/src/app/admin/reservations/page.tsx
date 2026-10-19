'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import styles from './reservations.module.css';
import { formatAmount } from '@/lib/format';
import { useConfirm } from '@/components/confirm-dialog';
import { useToast } from '@/components/toast';

interface Reservation {
  id: string; reservationNumber: string; vehicleId: string; customerId: string;
  pickupAt: string; returnAt: string; rentalDays: number;
  dailyPrice: string; depositAmount: string; totalAmount: string;
  status: string; createdAt: string; customerNotes: string | null;
  decisionReason: string | null;
  archivedAt?: string | null; archivedBy?: string | null;
  pickupLocation?:string|null;dropoffLocation?:string|null;
}
interface Vehicle { id: string; brandName: string; modelName: string; imageUrl?: string | null; }
interface Customer { id: string; firstName: string; lastName: string; email: string; }
interface Location { id: string; name: string; city: string; canPickup: boolean; canDropoff: boolean; enabled: boolean; country?: string; }
interface EditForm { vehicleId: string; pickupAt: string; returnAt: string; pickupLocationId: string; dropoffLocationId: string; }
interface EditPreview { available: boolean; message: string | null; currentTotal: string; newTotal: string; priceDifference: string; rentalDays: number; }

// Convertit un instant ISO en valeur locale pour <input type="datetime-local">.
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
interface ApiError { message?: string | string[]; }
async function errorMessage(response: Response) {
  try { const data: ApiError = await response.json(); return Array.isArray(data.message) ? data.message.join(', ') : data.message || `HTTP ${response.status}`; }
  catch { return `HTTP ${response.status}`; }
}
const STATUS_CLASS: Record<string, string> = {
  pending: styles.statusPending,
  confirmed: styles.statusConfirmed,
  converted: styles.statusConverted,
  expired: styles.statusExpired,
  cancelled: styles.statusCancelled,
  rejected: styles.statusRejected,
};

function statusClass(status: string): string {
  return STATUS_CLASS[status] ?? styles.statusPending;
}

export default function AdminReservationsPage() {
  const confirm = useConfirm();
  const toast = useToast();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [vehicleFilter, setVehicleFilter] = useState('all');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [archiveFilter, setArchiveFilter] = useState<'active' | 'archived' | 'all'>('active');
  const [processing, setProcessing] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [editing, setEditing] = useState<Reservation | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ vehicleId: '', pickupAt: '', returnAt: '', pickupLocationId: '', dropoffLocationId: '' });
  const [editPreview, setEditPreview] = useState<EditPreview | null>(null);
  const [editMessage, setEditMessage] = useState('');
  const [editBusy, setEditBusy] = useState(false);
  // Empreinte des valeurs ayant reçu une validation serveur réussie.
  // Elle autorise l'enregistrement UNIQUEMENT pour ces valeurs précises.
  const [editValidated, setEditValidated] = useState<string | null>(null);
  // Numéro de la dernière requête d'aperçu : une réponse obsolète (ou
  // reçue après une modification du formulaire) ne doit jamais valider de
  // nouvelles valeurs ni écraser un aperçu plus récent.
  const editRequestSeq = useRef(0);

  // Vue « réservations confirmées » (suivi opérationnel) et fenêtre
  // temporelle, indépendantes des filtres de la liste générale.
  const [section, setSection] = useState<'all' | 'confirmed'>('all');
  const [confirmedWindow, setConfirmedWindow] = useState<'all' | 'upcoming' | 'ongoing' | 'finished'>('all');
  // Réservation mise en évidence après un clic sur une notification.
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const focusApplied = useRef(false);

  // Instant de référence mis à jour périodiquement : les calculs de
  // fenêtre temporelle et d'archivage restent purs (jamais Date.now()
  // pendant le rendu, conformément aux règles des hooks React).
  const [currentTime, setCurrentTime] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setCurrentTime(Date.now());
    const start = window.setTimeout(update, 0);
    const timer = window.setInterval(update, 60000);
    return () => { window.clearTimeout(start); window.clearInterval(timer); };
  }, []);

  async function refresh() {
    const response = await fetch('/api/admin/reservations', { cache: 'no-store' });
    if (!response.ok) throw new Error(await errorMessage(response));
    const result: unknown = await response.json();
    if (!Array.isArray(result)) throw new Error('Invalid reservations response.');
    setReservations(result as Reservation[]);
  }
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [r,v,c,l] = await Promise.all([
          fetch('/api/admin/reservations', {cache:'no-store'}),
          fetch('/api/vehicles/catalog', {cache:'no-store'}),
          fetch('/api/admin/customers', {cache:'no-store'}),
          fetch('/api/admin/premium/locations', {cache:'no-store'}),
        ]);
        if (!r.ok) throw new Error(await errorMessage(r));
        const reservationsResponse: unknown = await r.json();
        if (!Array.isArray(reservationsResponse)) throw new Error('Invalid reservation list.');
        if (!active) return;
        setReservations(reservationsResponse as Reservation[]);
        if (v.ok) { const data: unknown = await v.json(); if (Array.isArray(data)) setVehicles(data as Vehicle[]); }
        if (c.ok) { const data: unknown = await c.json(); if (Array.isArray(data)) setCustomers(data as Customer[]); }
        if (l.ok) { const data: unknown = await l.json(); if (Array.isArray(data)) setLocations(data as Location[]); }
      } catch (caught) { if (active) setError(caught instanceof Error ? caught.message : 'Unable to load reservations.'); }
      finally { if (active) setLoading(false); }
    }
    void load(); return () => { active = false; };
  }, []);

  const customerName = (id: string) => {
    const customer = customers.find((c) => c.id === id);
    return customer ? `${customer.firstName} ${customer.lastName}` : id.slice(0, 8);
  };
  const vehicleName = (id: string) => {
    const vehicle = vehicles.find((v) => v.id === id);
    return vehicle ? `${vehicle.brandName} ${vehicle.modelName}` : id.slice(0, 8);
  };
  const visible = reservations.filter((r) => {
    const text = `${r.reservationNumber} ${customerName(r.customerId)} ${vehicleName(r.vehicleId)}`.toLowerCase();
    return text.includes(search.toLowerCase().trim()) && (status === 'all' || r.status === status)
      && (vehicleFilter === 'all' || r.vehicleId === vehicleFilter)
      && (customerFilter === 'all' || r.customerId === customerFilter)
      && (archiveFilter === 'all' || (archiveFilter === 'archived') === Boolean(r.archivedAt))
      && (!fromDate || r.returnAt.slice(0,10) >= fromDate)
      && (!toDate || r.pickupAt.slice(0,10) <= toDate);
  });
  const archivedCount = reservations.filter((r) => r.archivedAt).length;
  const pendingCount = reservations.filter((r) => r.status === 'pending' && !r.archivedAt).length;
  const confirmedCount = reservations.filter((r) => r.status === 'confirmed' && !r.archivedAt).length;

  // Fenêtre opérationnelle d'une réservation confirmée : à venir (avant
  // le départ), en cours (entre départ et retour), terminée (après).
  const confirmedWindowOf = (r: Reservation): 'upcoming' | 'ongoing' | 'finished' => {
    const now = currentTime ?? 0;
    if (new Date(r.pickupAt).getTime() > now) return 'upcoming';
    if (new Date(r.returnAt).getTime() >= now) return 'ongoing';
    return 'finished';
  };
  const vehicleImage = (id: string) => vehicles.find((v) => v.id === id)?.imageUrl ?? null;
  const confirmedVisible = reservations.filter((r) =>
    r.status === 'confirmed' && !r.archivedAt
    && (confirmedWindow === 'all' || confirmedWindowOf(r) === confirmedWindow)
    && `${r.reservationNumber} ${customerName(r.customerId)} ${vehicleName(r.vehicleId)}`
      .toLowerCase().includes(search.toLowerCase().trim()));

  // Règle d'archivage symétrique de celle du serveur : une réservation
  // confirmée ne peut être archivée qu'après sa date de retour planifiée.
  const canArchive = (r: Reservation): boolean => {
    if (r.archivedAt) return true;
    if (r.status === 'rejected') return true;
    if (r.status !== 'confirmed') return false;
    return currentTime !== null && new Date(r.returnAt).getTime() <= currentTime;
  };

  // Ouverture directe depuis une notification : ?focus=RES-....
  // On lève les filtres susceptibles de masquer la réservation, on la
  // déplie puis on la met brièvement en évidence. Les mises à jour
  // d'état sont différées hors du corps synchrone de l'effet.
  useEffect(() => {
    if (loading || focusApplied.current) return;
    const focus = new URLSearchParams(window.location.search).get('focus');
    if (!focus) return;
    const target = reservations.find((r) => r.reservationNumber.toUpperCase() === focus.toUpperCase());
    if (!target) return;
    focusApplied.current = true;
    const apply = window.setTimeout(() => {
      setSection('all');
      setStatus('all'); setVehicleFilter('all'); setCustomerFilter('all');
      setArchiveFilter('all'); setSearch('');
      setExpanded(target.id);
      setFocusedId(target.id);
    }, 0);
    const scroll = window.setTimeout(() => {
      document.getElementById(`reservation-${target.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
    const clear = window.setTimeout(() => setFocusedId(null), 5000);
    return () => { window.clearTimeout(apply); window.clearTimeout(scroll); window.clearTimeout(clear); };
  }, [loading, reservations]);

  async function decide(reservation: Reservation, action: 'confirm' | 'reject') {
    if (processing) return;
    const reason = reasons[reservation.reservationNumber]?.trim() ?? '';
    if (action === 'reject' && (reason.length < 5 || reason.length > 500)) {
      setError('Please enter a rejection reason between 5 and 500 characters.'); return;
    }
    const approved = await confirm({
      title: action === 'confirm' ? 'Confirm reservation' : 'Reject reservation',
      message: action === 'confirm'
        ? `Reservation ${reservation.reservationNumber} will be approved and the customer notified that the booking is confirmed.`
        : `Reservation ${reservation.reservationNumber} will be rejected and the customer notified.\n\nReason: ${reason}`,
      confirmLabel: action === 'confirm' ? 'Confirm reservation' : 'Reject reservation',
      cancelLabel: 'Back',
      tone: action === 'confirm' ? 'success' : 'danger',
    });
    if (!approved) return;
    setProcessing(reservation.reservationNumber); setError(''); setSuccess('');
    try {
      const response = await fetch('/api/admin/reservations', {method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({reservationNumber:reservation.reservationNumber, action, ...(action === 'reject' ? {reason} : {})})});
      if (!response.ok) throw new Error(await errorMessage(response));
      await refresh();
      const outcome = action === 'confirm'
        ? `Reservation ${reservation.reservationNumber} has been confirmed. The customer has been notified.`
        : `Reservation ${reservation.reservationNumber} has been rejected. Reason: ${reason}`;
      setSuccess(outcome);
      toast.success(outcome, action === 'confirm' ? 'Reservation confirmed' : 'Reservation rejected');
      setReasons((previous) => { const next = { ...previous }; delete next[reservation.reservationNumber]; return next; });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Action failed.';
      setError(message);
      toast.error(message, 'Reservation');
    }
    finally { setProcessing(null); }
  }

  async function setArchive(reservation: Reservation, archive: boolean) {
    if (processing) return;
    const approved = await confirm({
      title: archive ? 'Archive reservation' : 'Restore reservation',
      message: archive
        ? `Reservation ${reservation.reservationNumber} will be hidden from the working list while remaining in the database. You can restore it at any time.`
        : `Reservation ${reservation.reservationNumber} will be visible again in the working list.`,
      confirmLabel: archive ? 'Archive reservation' : 'Restore reservation',
      cancelLabel: 'Back',
    });
    if (!approved) return;
    setProcessing(reservation.reservationNumber); setError(''); setSuccess('');
    try {
      const response = await fetch('/api/admin/reservations', {method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({reservationNumber:reservation.reservationNumber, action: archive ? 'archive' : 'restore'})});
      if (!response.ok) throw new Error(await errorMessage(response));
      await refresh();
      const outcome = `Reservation ${reservation.reservationNumber} has been ${archive ? 'archived' : 'restored'}.`;
      setSuccess(outcome);
      toast.success(outcome, 'Reservation');
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Action failed.';
      setError(message);
      toast.error(message, 'Reservation');
    }
    finally { setProcessing(null); }
  }

  async function removeReservation(reservation: Reservation) {
    if (processing) return;
    const approved = await confirm({
      title: 'Delete reservation',
      message: `Reservation ${reservation.reservationNumber} will be permanently deleted. This cancelled booking will be removed from the database and cannot be recovered.`,
      confirmLabel: 'Delete reservation',
      cancelLabel: 'Back',
      tone: 'danger',
    });
    if (!approved) return;
    setProcessing(reservation.reservationNumber); setError(''); setSuccess('');
    try {
      const response = await fetch(`/api/admin/reservations?reservationNumber=${encodeURIComponent(reservation.reservationNumber)}`, {method:'DELETE'});
      if (!response.ok) throw new Error(await errorMessage(response));
      await refresh();
      const outcome = `Reservation ${reservation.reservationNumber} has been permanently deleted.`;
      setSuccess(outcome);
      toast.success(outcome, 'Reservation deleted');
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Action failed.';
      setError(message);
      toast.error(message, 'Reservation');
    }
    finally { setProcessing(null); }
  }

  // Une réservation est modifiable tant qu'elle est en attente ou
  // confirmée et que la prise en charge n'a pas commencé.
  const canEdit = (r: Reservation) =>
    currentTime !== null &&
    (r.status === 'pending' || r.status === 'confirmed') &&
    new Date(r.pickupAt).getTime() > currentTime;

  function openEdit(r: Reservation) {
    setEditing(r);
    // Invalide tout aperçu encore en vol : seule la dernière action compte.
    editRequestSeq.current += 1;
    setEditPreview(null);
    setEditValidated(null);
    setEditMessage('');
    const pickup = locations.find((loc) => `${loc.name} — ${loc.city}` === r.pickupLocation);
    const dropoff = locations.find((loc) => `${loc.name} — ${loc.city}` === r.dropoffLocation);
    setEditForm({
      vehicleId: r.vehicleId,
      pickupAt: toLocalInput(r.pickupAt),
      returnAt: toLocalInput(r.returnAt),
      pickupLocationId: pickup?.id ?? '',
      dropoffLocationId: dropoff?.id ?? '',
    });
  }

  // Toute modification invalide le résultat (disponibilité/prix)
  // précédent : il ne doit jamais servir à enregistrer d'anciennes
  // valeurs ni à débloquer le bouton « Save changes » à tort.
  function updateEditForm(patch: Partial<EditForm>) {
    setEditForm((form) => ({ ...form, ...patch }));
    // Invalide l'aperçu précédent ET toute réponse encore en vol.
    editRequestSeq.current += 1;
    setEditPreview(null);
    setEditValidated(null);
    setEditMessage('');
  }

  // Ferme l'éditeur et ignore toute réponse d'aperçu encore en vol.
  function closeEdit() {
    editRequestSeq.current += 1;
    setEditing(null);
    setEditPreview(null);
    setEditValidated(null);
    setEditMessage('');
  }

  // Ne transmet que les champs réellement modifiés.
  function buildEditPayload(): Record<string, string> {
    if (!editing) return {};
    const payload: Record<string, string> = {};
    if (editForm.vehicleId && editForm.vehicleId !== editing.vehicleId) payload.vehicleId = editForm.vehicleId;
    if (editForm.pickupLocationId) payload.pickupLocationId = editForm.pickupLocationId;
    if (editForm.dropoffLocationId) payload.dropoffLocationId = editForm.dropoffLocationId;
    if (editForm.pickupAt && editForm.pickupAt !== toLocalInput(editing.pickupAt)) {
      payload.pickupAt = new Date(editForm.pickupAt).toISOString();
    }
    if (editForm.returnAt && editForm.returnAt !== toLocalInput(editing.returnAt)) {
      payload.returnAt = new Date(editForm.returnAt).toISOString();
    }
    return payload;
  }

  // Contrôles rapides côté navigateur ; le serveur reste l'autorité
  // finale (mêmes règles réappliquées dans une transaction verrouillée).
  function validateEditForm(): string | null {
    if (!editing) return null;
    const pickupIso = editForm.pickupAt ? new Date(editForm.pickupAt).toISOString() : new Date(editing.pickupAt).toISOString();
    const returnIso = editForm.returnAt ? new Date(editForm.returnAt).toISOString() : new Date(editing.returnAt).toISOString();
    if (new Date(returnIso).getTime() <= new Date(pickupIso).getTime()) {
      return 'The return date must be after the pick-up date.';
    }
    // Points de départ et d'arrivée : même pays. On ne contrôle que
    // lorsque les deux identifiants sont explicitement connus.
    const pickup = editForm.pickupLocationId ? locations.find((l) => l.id === editForm.pickupLocationId) : undefined;
    const dropoffId = editForm.dropoffLocationId || editForm.pickupLocationId;
    const dropoff = dropoffId ? locations.find((l) => l.id === dropoffId) : undefined;
    if (pickup?.country && dropoff?.country && pickup.country !== dropoff.country) {
      return 'Pick-up and drop-off points must be in the same country.';
    }
    return null;
  }

  async function previewEdit() {
    if (!editing || editBusy) return;
    const payload = buildEditPayload();
    if (Object.keys(payload).length === 0) {
      setEditPreview(null);
      setEditValidated(null);
      setEditMessage('Change at least one value to preview the impact.');
      return;
    }
    const invalid = validateEditForm();
    if (invalid) {
      setEditPreview(null);
      setEditValidated(null);
      setEditMessage(invalid);
      return;
    }
    const signature = JSON.stringify(payload);
    // Numéro de cette requête : toute réponse plus ancienne sera ignorée.
    const seq = ++editRequestSeq.current;
    setEditBusy(true); setEditMessage(''); setEditPreview(null); setEditValidated(null);
    try {
      const response = await fetch(`/api/admin/reservations/${encodeURIComponent(editing.reservationNumber)}/edit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(await errorMessage(response));
      const data: EditPreview = await response.json();
      // La saisie a changé entre-temps : cette réponse ne doit valider
      // aucune valeur et ne pas écraser un aperçu plus récent.
      if (seq !== editRequestSeq.current) return;
      setEditPreview(data);
      if (data.available) {
        setEditValidated(signature);
        setEditMessage('');
      } else {
        setEditValidated(null);
        setEditMessage(data.message ?? 'The new period is unavailable.');
      }
    } catch (caught) {
      if (seq !== editRequestSeq.current) return;
      setEditValidated(null);
      setEditMessage(caught instanceof Error ? caught.message : 'Preview failed.');
    } finally { setEditBusy(false); }
  }

  async function saveEdit() {
    if (!editing || editBusy) return;
    const payload = buildEditPayload();
    if (Object.keys(payload).length === 0) { setEditMessage('No modification to save.'); return; }
    // N'enregistrer que des valeurs ayant reçu une validation serveur
    // réussie : évite toute écriture non contrôlée.
    if (editValidated !== JSON.stringify(payload)) {
      setEditMessage('Check availability & price for the current values before saving.');
      return;
    }
    // Verrouille immédiatement la soumission : un double-clic pendant la
    // confirmation ne peut pas déclencher deux PATCH.
    setEditBusy(true);
    try {
      const approved = await confirm({
        title: 'Update reservation',
        message: `Reservation ${editing.reservationNumber} will be updated. Availability is rechecked and prices are recalculated by the server.`,
        confirmLabel: 'Save changes',
        cancelLabel: 'Cancel',
      });
      if (!approved) return;
      setEditMessage('');
      const response = await fetch(`/api/admin/reservations/${encodeURIComponent(editing.reservationNumber)}/edit`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(await errorMessage(response));
      const result = await response.json() as { priceDifference?: string };
      const number = editing.reservationNumber;
      await refresh();
      setEditing(null); setEditPreview(null); setEditValidated(null);
      const diff = result?.priceDifference ? ` Price change: ${formatAmount(result.priceDifference)} EUR.` : '';
      const outcome = `Reservation ${number} has been updated.${diff}`;
      setSuccess(outcome);
      toast.success(outcome, 'Reservation updated');
    } catch (caught) {
      // Le serveur peut avoir refusé (conflit/prix) : l'aperçu devient obsolète.
      setEditValidated(null);
      const message = caught instanceof Error ? caught.message : 'Update failed.';
      setEditMessage(message);
      toast.error(message, 'Reservation');
    } finally { setEditBusy(false); }
  }

  return <main className={styles.page}><section className={styles.container}>
    <Link href="/admin" className={styles.back}>← Back to dashboard</Link>
    <header className={styles.hero}>
      <p className={styles.eyebrow}>ADMINISTRATOR MANAGEMENT</p>
      <h1 className={styles.title}>Reservation management</h1>
      <p className={styles.intro}>Search every reservation, inspect the details, then confirm or reject the request.</p>
    </header>
    <div className={styles.filters}>
      <label>Search<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Reservation, vehicle or customer" /></label>
      <label>Status<select value={status} onChange={(e) => setStatus(e.target.value)}>
        {['all','pending','confirmed','rejected','cancelled','expired','converted'].map((v) => <option key={v} value={v}>{v}</option>)}
      </select></label>
      <label>Customer<select value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)}>
        <option value="all">All customers</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
      </select></label>
      <label>Vehicle<select value={vehicleFilter} onChange={(e) => setVehicleFilter(e.target.value)}>
        <option value="all">All vehicles</option>{vehicles.map((v) => <option key={v.id} value={v.id}>{v.brandName} {v.modelName}</option>)}
      </select></label>
      <label>From<input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}/></label>
      <label>Until<input type="date" min={fromDate || undefined} value={toDate} onChange={(e) => setToDate(e.target.value)}/></label>
      <div className={styles.filterGroup}>
        <span className={styles.filterCaption}>Archive</span>
        <div className={styles.segmented} role="group" aria-label="Filter by archive state">
          <button type="button" className={archiveFilter === 'active' ? styles.segmentActive : styles.segment} aria-pressed={archiveFilter === 'active'} onClick={() => setArchiveFilter('active')}>Active</button>
          <button type="button" className={archiveFilter === 'archived' ? styles.segmentActive : styles.segment} aria-pressed={archiveFilter === 'archived'} onClick={() => setArchiveFilter('archived')}>Archived ({archivedCount})</button>
          <button type="button" className={archiveFilter === 'all' ? styles.segmentActive : styles.segment} aria-pressed={archiveFilter === 'all'} onClick={() => setArchiveFilter('all')}>All</button>
        </div>
      </div>
    </div>
    <div className={styles.stats}>
      <div className={styles.stat}><span className={styles.statValue}>{reservations.length}</span><span className={styles.statLabel}>Total</span></div>
      <div className={`${styles.stat} ${styles.statPending}`}><span className={styles.statValue}>{pendingCount}</span><span className={styles.statLabel}>Pending</span></div>
      <div className={`${styles.stat} ${styles.statConfirmed}`}><span className={styles.statValue}>{confirmedCount}</span><span className={styles.statLabel}>Confirmed</span></div>
      <div className={`${styles.stat} ${styles.statArchived}`}><span className={styles.statValue}>{archivedCount}</span><span className={styles.statLabel}>Archived</span></div>
    </div>
    {error && <div role="alert" className={styles.error}>{error}</div>}
    {success && <div role="status" className={styles.success}>{success}</div>}
    {loading && <p>Loading reservations...</p>}
    {!loading && <div className={styles.viewSwitch} role="tablist" aria-label="Reservation view">
      <button type="button" role="tab" aria-selected={section === 'all'} className={section === 'all' ? styles.viewTabActive : styles.viewTab} onClick={() => setSection('all')}>All reservations</button>
      <button type="button" role="tab" aria-selected={section === 'confirmed'} className={section === 'confirmed' ? styles.viewTabActive : styles.viewTab} onClick={() => setSection('confirmed')}>Confirmed reservations ({confirmedCount})</button>
    </div>}
    {!loading && section === 'all' && <><div className={styles.topRow}><h2>{archiveFilter === 'archived' ? 'Archived reservations' : 'All reservations'}</h2><span className={styles.count}>{visible.length} results</span></div>
      {!visible.length && <div className={styles.empty}><p>No reservations match these filters.</p></div>}
      <div className={styles.grid}>{visible.map((r) => <article key={r.id} id={`reservation-${r.id}`} className={`${r.archivedAt ? `${styles.card} ${styles.archivedCard}` : styles.card}${focusedId === r.id ? ` ${styles.focusCard}` : ''}`}>
        <div className={styles.cardTop}><div><span className={styles.cardLabel}>RESERVATION NUMBER</span><h3>{r.reservationNumber}</h3></div>
          <div className={styles.cardBadges}><span className={`${styles.pendingBadge} ${statusClass(r.status)}`}>{r.status}</span>{r.archivedAt && <span className={styles.archivedBadge}>Archived</span>}
            {canEdit(r) && <button type="button" className={styles.editButton} disabled={Boolean(processing)}
              onClick={() => openEdit(r)}
              aria-label={`Edit reservation ${r.reservationNumber}`}
              title="Edit reservation">
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
            </button>}
            {(r.archivedAt || r.status === 'confirmed' || r.status === 'rejected') && <button type="button" className={styles.archiveButton} disabled={Boolean(processing) || !canArchive(r)}
              onClick={() => void setArchive(r, !r.archivedAt)}
              aria-label={r.archivedAt ? 'Restore reservation' : 'Archive reservation'}
              title={!canArchive(r) ? 'A confirmed reservation cannot be archived before its scheduled return date.' : (r.archivedAt ? 'Restore reservation' : 'Archive reservation')}>
              {r.archivedAt
                ? <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="5" rx="1" />
                    <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
                    <path d="m9 15 3-3 3 3" />
                    <path d="M12 12v9" />
                  </svg>
                : <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="5" rx="1" />
                    <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
                    <path d="M10 12h4" />
                  </svg>}
            </button>}
            {r.status === 'cancelled' && <button type="button" className={styles.deleteButton} disabled={Boolean(processing)}
              onClick={() => void removeReservation(r)}
              aria-label="Delete reservation"
              title="Delete reservation">
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18" />
                <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
              </svg>
            </button>}</div></div>
        <div className={styles.vehicleSection}><span className={styles.cardLabel}>SELECTED VEHICLE</span><h4>{vehicleName(r.vehicleId)}</h4></div>
        <div className={styles.details}>
          <div><span>Customer</span><strong>{customerName(r.customerId)}</strong></div>
          <div><span>Pickup</span><strong>{r.pickupAt.slice(0,10)}</strong></div>
          <div><span>Return</span><strong>{r.returnAt.slice(0,10)}</strong></div>
          <div><span>Pick-up point</span><strong>{r.pickupLocation||'Legacy booking'}</strong></div>
          <div><span>Drop-off point</span><strong>{r.dropoffLocation||'Legacy booking'}</strong></div>
          <div><span>Duration</span><strong>{r.rentalDays} days</strong></div>
          <div><span>Total</span><strong>{formatAmount(r.totalAmount)}</strong></div>
          <div><span>Deposit</span><strong>{formatAmount(r.depositAmount)}</strong></div>
        </div>
        <button type="button" className={styles.detailsButton} onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
          {expanded === r.id ? 'Hide details' : 'View complete details'}
        </button>
        {expanded === r.id && <div className={styles.details}>
          <div><span>Daily rate</span><strong>{formatAmount(r.dailyPrice)}</strong></div>
          <div><span>Created</span><strong>{r.createdAt.slice(0,10)}</strong></div>
          <div><span>Vehicle ID</span><strong>{r.vehicleId}</strong></div>
          <div><span>Customer ID</span><strong>{r.customerId}</strong></div>
          <div><span>Notes</span><strong>{r.customerNotes || '—'}</strong></div>
          <div><span>Decision reason</span><strong>{r.decisionReason || '—'}</strong></div>
        </div>}
        {r.status === 'pending' && <div className={styles.decisionSection}>
          <label className={styles.reasonLabel} htmlFor={`reason-${r.id}`}>Rejection reason (required only for rejection)</label>
          <textarea id={`reason-${r.id}`} className={styles.reasonInput} maxLength={500} value={reasons[r.reservationNumber] ?? ''}
            onChange={(e) => setReasons((p) => ({...p,[r.reservationNumber]:e.target.value}))} />
          <div className={styles.actions}>
            <button type="button" className={styles.confirmButton} disabled={Boolean(processing)} onClick={() => void decide(r,'confirm')}>Confirm</button>
            <button type="button" className={styles.rejectButton} disabled={Boolean(processing)} onClick={() => void decide(r,'reject')}>Reject</button>
          </div>
        </div>}
      </article>)}</div>
    </>}
    {!loading && section === 'confirmed' && <>
      <div className={styles.topRow}><h2>Confirmed reservations</h2><span className={styles.count}>{confirmedVisible.length} results</span></div>
      <div className={styles.filterGroup}>
        <span className={styles.filterCaption}>Window</span>
        <div className={styles.segmented} role="group" aria-label="Filter confirmed reservations by period">
          {(['all','upcoming','ongoing','finished'] as const).map((w) => <button key={w} type="button" className={confirmedWindow === w ? styles.segmentActive : styles.segment} aria-pressed={confirmedWindow === w} onClick={() => setConfirmedWindow(w)}>{w[0].toUpperCase() + w.slice(1)}</button>)}
        </div>
      </div>
      {!confirmedVisible.length && <div className={styles.empty}><p>No confirmed reservations in this window.</p></div>}
      <div className={styles.confirmedGrid}>{confirmedVisible.map((r) => {
        const image = vehicleImage(r.vehicleId);
        const window = confirmedWindowOf(r);
        return <article key={r.id} id={`reservation-${r.id}`} className={`${styles.confirmedCard}${focusedId === r.id ? ` ${styles.focusCard}` : ''}`}>
          <div className={styles.confirmedMedia}>{image
            ? <img src={image} alt={vehicleName(r.vehicleId)} loading="lazy" />
            : <div className={styles.confirmedMediaEmpty} aria-hidden="true"><span>No image</span></div>}</div>
          <div className={styles.confirmedBody}>
            <div className={styles.confirmedHead}>
              <span className={styles.cardLabel}>{r.reservationNumber}</span>
              <span className={`${styles.windowBadge} ${window === 'ongoing' ? styles.windowOngoing : window === 'upcoming' ? styles.windowUpcoming : styles.windowFinished}`}>{window}</span>
            </div>
            <h3>{vehicleName(r.vehicleId)}</h3>
            <div className={styles.details}>
              <div><span>Customer</span><strong>{customerName(r.customerId)}</strong></div>
              <div><span>Pickup</span><strong>{r.pickupAt.slice(0,10)}</strong></div>
              <div><span>Return</span><strong>{r.returnAt.slice(0,10)}</strong></div>
              <div><span>Pick-up point</span><strong>{r.pickupLocation || 'Legacy booking'}</strong></div>
              <div><span>Drop-off point</span><strong>{r.dropoffLocation || 'Legacy booking'}</strong></div>
              <div><span>Duration</span><strong>{r.rentalDays} days</strong></div>
              <div><span>Total</span><strong>{formatAmount(r.totalAmount)} EUR</strong></div>
              <div><span>Deposit</span><strong>{formatAmount(r.depositAmount)} EUR</strong></div>
            </div>
            <div className={styles.confirmedActions}>
              {canEdit(r) && <button type="button" className={styles.detailsButton} disabled={Boolean(processing)} onClick={() => openEdit(r)}>Edit reservation</button>}
              <button type="button" className={styles.archiveButton} disabled={Boolean(processing) || !canArchive(r)}
                title={canArchive(r) ? 'Archive reservation' : 'A confirmed reservation cannot be archived before its scheduled return date.'}
                onClick={() => void setArchive(r, true)}>Archive</button>
            </div>
          </div>
        </article>;
      })}</div>
    </>}
    {editing && <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-label={`Edit reservation ${editing.reservationNumber}`}>
      <div className={styles.modal}>
        <div className={styles.modalHead}>
          <div>
            <span className={styles.cardLabel}>EDIT RESERVATION</span>
            <h3>{editing.reservationNumber}</h3>
          </div>
          <button type="button" className={styles.modalClose}
            onClick={closeEdit}
            aria-label="Close edit dialog">×</button>
        </div>
        <div className={styles.modalBody}>
          <label className={styles.editField}>Vehicle
            <select value={editForm.vehicleId} onChange={(e) => updateEditForm({ vehicleId: e.target.value })}>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.brandName} {v.modelName}</option>)}
            </select>
          </label>
          <label className={styles.editField}>Pick-up date &amp; time
            <input type="datetime-local" value={editForm.pickupAt} onChange={(e) => updateEditForm({ pickupAt: e.target.value })}/>
          </label>
          <label className={styles.editField}>Return date &amp; time
            <input type="datetime-local" value={editForm.returnAt} onChange={(e) => updateEditForm({ returnAt: e.target.value })}/>
          </label>
          <label className={styles.editField}>Pick-up point
            <select value={editForm.pickupLocationId} onChange={(e) => updateEditForm({ pickupLocationId: e.target.value })}>
              <option value="">Keep current ({editing.pickupLocation || 'legacy booking'})</option>
              {locations.filter((l) => l.enabled && l.canPickup).map((l) => <option key={l.id} value={l.id}>{l.name} — {l.city}</option>)}
            </select>
          </label>
          <label className={styles.editField}>Drop-off point
            <select value={editForm.dropoffLocationId} onChange={(e) => updateEditForm({ dropoffLocationId: e.target.value })}>
              <option value="">Keep current ({editing.dropoffLocation || 'legacy booking'})</option>
              {locations.filter((l) => l.enabled && l.canDropoff).map((l) => <option key={l.id} value={l.id}>{l.name} — {l.city}</option>)}
            </select>
          </label>
        </div>
        <p className={styles.editHint}>
          Prices and availability are always recalculated by the server. Paid totals and financial
          history are never altered silently.
        </p>
        {editPreview && <div className={styles.previewBox}>
          <div><span>Availability</span><strong>{editPreview.available ? 'Available' : 'Unavailable'}</strong></div>
          <div><span>Current total</span><strong>{formatAmount(editPreview.currentTotal)} EUR</strong></div>
          <div><span>New total</span><strong>{formatAmount(editPreview.newTotal)} EUR</strong></div>
          <div><span>Difference</span><strong>{formatAmount(editPreview.priceDifference)} EUR</strong></div>
          <div><span>New duration</span><strong>{editPreview.rentalDays} day(s)</strong></div>
        </div>}
        {editMessage && <div role="alert" className={styles.error}>{editMessage}</div>}
        <div className={styles.modalActions}>
          <button type="button" className={styles.cancelEditButton} disabled={editBusy}
            onClick={closeEdit}>
            Cancel
          </button>
          <button type="button" className={styles.detailsButton} disabled={editBusy} onClick={() => void previewEdit()}>
            {editBusy ? 'Working...' : 'Check availability & price'}
          </button>
          <button type="button" className={styles.confirmButton}
            disabled={editBusy || editValidated !== JSON.stringify(buildEditPayload())}
            title={editValidated !== JSON.stringify(buildEditPayload()) ? 'Check availability & price first' : undefined}
            onClick={() => void saveEdit()}>Save changes</button>
        </div>
      </div>
    </div>}
  </section></main>;
}
