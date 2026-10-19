'use client';
import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';

import { useConfirm } from '@/components/confirm-dialog';
import { useToast } from '@/components/toast';

import styles from './calendar.module.css';

interface Vehicle { id: string; modelId: string; status: string; licensePlate: string; }
interface Model { id: string; name: string; brandId: string; }
interface Brand { id: string; name: string; }
interface Fleet { vehicles: Vehicle[]; models: Model[]; brands: Brand[]; }
interface Reservation { id: string; vehicleId: string; reservationNumber: string; pickupAt: string; returnAt: string; status: string; }
interface Block { id: string; vehicleId: string; startsAt: string; endsAt: string; reason: string; notes: string | null; }
interface AuditBlock { id: string; unavailabilityId: string; vehicleId: string; startsAt: string; endsAt: string; reason: string; notes: string | null; releasedAt: string; releaseReason: string | null; releasedByName: string | null; }
const REASONS = ['maintenance', 'repair', 'inspection', 'other'] as const;
const dateString = (day: Date) => day.toISOString().slice(0, 10);
const dayStart = (date: Date) => Date.parse(dateString(date) + 'T00:00:00Z');
const monthStart = () => new Date().toISOString().slice(0,7);
const pad = (value: number) => String(value).padStart(2, '0');
const toLocalInput = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
export default function AdminAvailabilityPage() {
  const [month, setMonth] = useState(monthStart);
  const [fleet, setFleet] = useState<Fleet>({vehicles: [],models: [],brands: []});
  const [vehicleId, setVehicleId] = useState('');
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [history, setHistory] = useState<AuditBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);

  // Formulaire de bloc de maintenance.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [reason, setReason] = useState<string>('maintenance');
  const [blockStart, setBlockStart] = useState('');
  const [blockEnd, setBlockEnd] = useState('');
  const [blockNotes, setBlockNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const confirm = useConfirm();
  const toast = useToast();

  // Motif de libération facultatif, saisi par bloc.
  const [releaseReason, setReleaseReason] = useState<Record<string, string>>({});

  useEffect(() => {
    const abort = new AbortController();
    async function load() {
      setLoading(true);setError('');
      try {
        const [v,r,b,h] = await Promise.all([
          fetch('/api/admin/vehicles', {cache:'no-store',signal:abort.signal}),
          fetch('/api/admin/reservations', {cache:'no-store',signal:abort.signal}),
          fetch(`/api/admin/availability?month=${encodeURIComponent(month)}`, {cache:'no-store',signal:abort.signal}),
          fetch(`/api/admin/availability/history?month=${encodeURIComponent(month)}`, {cache:'no-store',signal:abort.signal}),
        ]);
        if (!v.ok || !r.ok || !b.ok) throw new Error(`Unable to load availability calendar (HTTP ${[v.status,r.status,b.status].join('/')}).`);
        const vehicleData: unknown = await v.json();
        const reservationData: unknown = await r.json();
        const blocksData: unknown = await b.json();
        // L'historique d'audit est facultatif : une erreur ne doit pas
        // empêcher l'affichage du calendrier de disponibilité.
        const historyData: unknown = h.ok ? await h.json().catch(() => []) : [];
        if (typeof vehicleData !== 'object' || vehicleData === null || !('vehicles' in vehicleData) || !Array.isArray((vehicleData as Fleet).vehicles)
          || !Array.isArray(reservationData) || !Array.isArray(blocksData)) throw new Error('Invalid calendar response.');
        if (abort.signal.aborted) return;
        const nextFleet = vehicleData as Fleet;
        setFleet(nextFleet);
        setVehicleId((current) => nextFleet.vehicles.some((item) => item.id === current) ? current : nextFleet.vehicles[0]?.id ?? '');
        setReservations(reservationData as Reservation[]);
        setBlocks(blocksData as Block[]);
        setHistory(Array.isArray(historyData) ? historyData as AuditBlock[] : []);
      } catch (caught) {
        if (!abort.signal.aborted) setError(caught instanceof Error ? caught.message : 'Unable to load calendar.');
      } finally {if (!abort.signal.aborted) setLoading(false);}
    }
    void load(); return () => abort.abort();
  }, [month, refresh]);
  const vehicleName = (vehicle: Vehicle) => {
    const model = fleet.models.find((item) => item.id === vehicle.modelId);
    const brand = fleet.brands.find((item) => item.id === model?.brandId);
    return `${brand?.name ?? ''} ${model?.name ?? ''} — ${vehicle.licensePlate}`.trim();
  };
  const vehicle = fleet.vehicles.find((item) => item.id === vehicleId);
  const vehicleBlocks = useMemo(
    () => blocks.filter((block) => block.vehicleId === vehicleId),
    [blocks, vehicleId],
  );
  const vehicleHistory = useMemo(
    () => history.filter((entry) => entry.vehicleId === vehicleId),
    [history, vehicleId],
  );
  const days = useMemo(() => {
    const [year, index] = month.split('-').map(Number);
    const count = new Date(Date.UTC(year,index,0)).getUTCDate();
    const offset = (new Date(Date.UTC(year,index-1,1)).getUTCDay()+6)%7;
    return [...Array(offset).fill(null), ...Array.from({length:count},(_,i)=>new Date(Date.UTC(year,index-1,i+1))) ] as (Date | null)[];
  }, [month]);
  const dayStatus = (date: Date): {type: 'available'|'reserved'|'unavailable'; description: string} => {
    if (!vehicle) return {type:'unavailable',description:'No vehicle selected'};
    if (vehicle.status !== 'active') return {type:'unavailable',description:vehicle.status};
    const start = dayStart(date), end = start+86400000;
    const maintenance = blocks.find((b) => b.vehicleId === vehicle.id && Date.parse(b.startsAt) < end && Date.parse(b.endsAt) > start);
    if (maintenance) return {type:'unavailable',description:maintenance.reason};
    const booking = reservations.find((r) => r.vehicleId === vehicle.id &&
      ['pending','confirmed','converted'].includes(r.status) && Date.parse(r.pickupAt) < end && Date.parse(r.returnAt) > start);
    if (booking) return {type:'reserved',description:`${booking.reservationNumber} (${booking.status})`};
    return {type:'available',description:'Available'};
  };
  function changeMonth(delta: number) {
    const [y,m] = month.split('-').map(Number);
    setMonth(new Date(Date.UTC(y,m-1+delta,1)).toISOString().slice(0,7));
  }
  function resetForm() {
    setEditingId(null);
    setReason('maintenance');
    setBlockStart('');
    setBlockEnd('');
    setBlockNotes('');
  }
  function startEdit(block: Block) {
    setEditingId(block.id);
    setReason(block.reason);
    setBlockStart(toLocalInput(block.startsAt));
    setBlockEnd(toLocalInput(block.endsAt));
    setBlockNotes(block.notes ?? '');
    setMessage('');
  }
  async function submitBlock(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    if (!vehicleId) { setMessage('Select a vehicle first.'); return; }
    if (!blockStart || !blockEnd) { setMessage('Provide a start and end date.'); return; }
    const startsAt = new Date(blockStart);
    const endsAt = new Date(blockEnd);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) { setMessage('Invalid maintenance period.'); return; }
    if (endsAt <= startsAt) { setMessage('The end must be after the start.'); return; }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        reason,
        notes: blockNotes,
      };
      const url = editingId ? `/api/admin/availability/${editingId}` : '/api/admin/availability';
      const method = editingId ? 'PATCH' : 'POST';
      if (!editingId) payload.vehicleId = vehicleId;
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result: unknown = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = result && typeof result === 'object' && 'message' in result ? String((result as { message?: unknown }).message) : 'Unable to save maintenance block.';
        throw new Error(detail);
      }
      const successMessage = editingId ? 'Maintenance block updated.' : 'Vehicle blocked for maintenance.';
      setMessage(successMessage);
      toast.success(successMessage, 'Availability');
      resetForm();
      setRefresh((value) => value + 1);
    } catch (caught) {
      const detail = caught instanceof Error ? caught.message : 'Unable to save maintenance block.';
      setMessage(detail);
      toast.error(detail, 'Availability');
    } finally {
      setSaving(false);
    }
  }
  async function releaseBlock(id: string) {
    setMessage('');
    const confirmed = await confirm({
      title: 'Release maintenance block',
      message:
        'Release this maintenance block? The vehicle becomes bookable again and the record is ' +
        'archived in the maintenance history.',
      confirmLabel: 'Release',
      tone: 'danger',
    });
    if (!confirmed) return;
    setSaving(true);
    try {
      const note = (releaseReason[id] ?? '').trim();
      const response = await fetch(`/api/admin/availability/${id}`, {
        method: 'DELETE',
        ...(note ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: note }) } : {}),
      });
      const result: unknown = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = result && typeof result === 'object' && 'message' in result ? String((result as { message?: unknown }).message) : 'Unable to release block.';
        throw new Error(detail);
      }
      const released = 'Maintenance block released and archived in the maintenance history.';
      setMessage(released);
      toast.success(released, 'Availability');
      if (editingId === id) resetForm();
      setReleaseReason((current) => { const next = {...current}; delete next[id]; return next; });
      setRefresh((value) => value + 1);
    } catch (caught) {
      const detail = caught instanceof Error ? caught.message : 'Unable to release block.';
      setMessage(detail);
      toast.error(detail, 'Availability');
    } finally {
      setSaving(false);
    }
  }
  return <main className={styles.page}>
    <Link href="/admin" className={styles.back}>← Back to dashboard</Link>
    <header className={styles.hero}>
      <p className={styles.eyebrow}>ADMINISTRATOR MANAGEMENT</p>
      <h1 className={styles.title}>Vehicle availability calendar</h1>
      <p className={styles.intro}>Review confirmed and pending reservations, vehicle maintenance and available days.</p>
    </header>
    <div className={styles.controls}>
      <label>Vehicle<select value={vehicleId} onChange={(e)=>{setVehicleId(e.target.value);resetForm();}}>
        {fleet.vehicles.map((item)=><option key={item.id} value={item.id}>{vehicleName(item)}</option>)}
      </select></label>
      <label>Month<input type="month" value={month} onChange={(e)=>setMonth(e.target.value)}/></label>
      <button onClick={()=>changeMonth(-1)} type="button">← Previous</button>
      <button onClick={()=>changeMonth(1)} type="button">Next →</button>
    </div>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {loading ? <p>Loading availability...</p> : <>
      <div className={styles.legend}><span className={styles.available}>Available</span><span className={styles.reserved}>Reserved</span><span className={styles.unavailable}>Unavailable</span></div>
      <div className={styles.calendar} role="grid" aria-label={`Vehicle calendar for ${month}`}>
        {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((day)=><div key={day} className={styles.weekday} role="columnheader">{day}</div>)}
        {days.map((date,i)=>date ? <div key={dateString(date)} className={`${styles.day} ${styles[dayStatus(date).type]}`} role="gridcell"
          title={dayStatus(date).description} aria-label={`${dateString(date)}: ${dayStatus(date).description}`}>
          <strong>{date.getUTCDate()}</strong><small>{dayStatus(date).description}</small>
        </div> : <div className={styles.placeholder} key={`offset-${i}`} aria-hidden="true" />)}
      </div>
      <p className={styles.note}>Calendar includes reserved intervals and recorded vehicle maintenance. The return date is treated as the end of the reservation interval.</p>

      <section className={styles.panel} aria-label="Maintenance management">
        <div className={styles.panelHeader}>
          <h2 className={styles.panelTitle}>{editingId ? 'Edit maintenance block' : 'Block vehicle for maintenance'}</h2>
          <p className={styles.panelHint}>Blocks are refused if they overlap a pending or confirmed reservation, protecting existing customer bookings.</p>
        </div>
        <form className={styles.form} onSubmit={submitBlock}>
          <label>Start<input type="datetime-local" value={blockStart} onChange={(e)=>setBlockStart(e.target.value)} required /></label>
          <label>End<input type="datetime-local" value={blockEnd} onChange={(e)=>setBlockEnd(e.target.value)} required /></label>
          <label>Reason<select value={reason} onChange={(e)=>setReason(e.target.value)}>
            {REASONS.map((item)=><option key={item} value={item}>{item}</option>)}
          </select></label>
          <label className={styles.wide}>Notes<textarea value={blockNotes} onChange={(e)=>setBlockNotes(e.target.value)} rows={2} maxLength={1000} placeholder="Optional details for the workshop" /></label>
          <div className={styles.formActions}>
            <button type="submit" disabled={saving || !vehicleId}>{saving ? 'Saving…' : editingId ? 'Save changes' : 'Block vehicle'}</button>
            {editingId && <button type="button" className={styles.secondary} onClick={resetForm} disabled={saving}>Cancel edit</button>}
          </div>
        </form>
        {message && <p role="status" className={styles.message}>{message}</p>}
        <h3 className={styles.listTitle}>Maintenance blocks this month{vehicle ? ` — ${vehicleName(vehicle)}` : ''}</h3>
        {vehicleBlocks.length === 0 ? <p className={styles.empty}>No maintenance block recorded for the selected vehicle in {month}.</p> : (
          <ul className={styles.blockList}>
            {vehicleBlocks.map((block)=><li key={block.id} className={styles.blockItem}>
              <div className={styles.blockInfo}>
                <strong>{block.reason}</strong>
                <span>{new Date(block.startsAt).toLocaleString()} → {new Date(block.endsAt).toLocaleString()}</span>
                {block.notes && <small>{block.notes}</small>}
              </div>
              <div className={styles.blockActions}>
                <input className={styles.releaseReason} value={releaseReason[block.id] ?? ''} onChange={(e)=>setReleaseReason((current)=>({...current,[block.id]:e.target.value}))} maxLength={500} placeholder="Release reason (optional)" aria-label={`Release reason for ${block.reason}`} disabled={saving} />
                <button type="button" onClick={()=>startEdit(block)} disabled={saving}>Edit</button>
                <button type="button" className={styles.danger} onClick={()=>releaseBlock(block.id)} disabled={saving}>Release</button>
              </div>
            </li>)}
          </ul>
        )}
      </section>

      <section className={styles.panel} aria-label="Released maintenance history">
        <div className={styles.panelHeader}>
          <h2 className={styles.panelTitle}>Released maintenance history</h2>
          <p className={styles.panelHint}>Immutable audit trail. Releasing a block restores vehicle availability while preserving the original maintenance record, its author and the release details.</p>
        </div>
        {vehicleHistory.length === 0 ? <p className={styles.empty}>No released maintenance recorded for the selected vehicle in {month}.</p> : (
          <ul className={styles.blockList}>
            {vehicleHistory.map((entry)=><li key={entry.id} className={styles.blockItem}>
              <div className={styles.blockInfo}>
                <strong>{entry.reason}</strong>
                <span>{new Date(entry.startsAt).toLocaleString()} → {new Date(entry.endsAt).toLocaleString()}</span>
                {entry.notes && <small>{entry.notes}</small>}
                <small className={styles.historyMeta}>Released {new Date(entry.releasedAt).toLocaleString()}{entry.releasedByName ? ` by ${entry.releasedByName}` : ''}{entry.releaseReason ? ` — ${entry.releaseReason}` : ''}</small>
              </div>
            </li>)}
          </ul>
        )}
      </section>
    </>}
  </main>;
}
