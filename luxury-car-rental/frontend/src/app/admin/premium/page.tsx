'use client';
import { useEffect, useState } from 'react';

import { useConfirm } from '@/components/confirm-dialog';
import { useToast } from '@/components/toast';

import styles from './premium.module.css';

interface ExtraRow { id: string; code: string; name: string; description: string | null; category: string; pricing: string; amount: string; enabled: boolean; }
interface PromotionRow { code: string; percentage: number; startDate: string; expiryDate: string; maxUses: number | null; uses: number; enabled: boolean; }

const EMPTY_EXTRA = { code: '', name: '', description: '', category: 'equipment', pricing: 'once', amount: 0, enabled: true };
const EMPTY_PROMO = { code: '', percentage: 10, startDate: '', expiryDate: '', maxUses: 100, enabled: true };

export default function PremiumAdminPage() {
  const [extra, setExtra] = useState(EMPTY_EXTRA);
  const [promo, setPromo] = useState(EMPTY_PROMO);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [extras, setExtras] = useState<ExtraRow[]>([]);
  const [promotions, setPromotions] = useState<PromotionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const confirm = useConfirm();
  const toast = useToast();

  async function loadLists() {
    setLoading(true); setError('');
    try {
      const [e, p] = await Promise.all([
        fetch('/api/admin/premium/extras', { cache: 'no-store' }),
        fetch('/api/admin/premium/promotions', { cache: 'no-store' }),
      ]);
      if (!e.ok || !p.ok) throw new Error(`Unable to load catalogue (HTTP ${e.status}/${p.status}).`);
      const extraData: unknown = await e.json();
      const promoData: unknown = await p.json();
      if (!Array.isArray(extraData) || !Array.isArray(promoData)) throw new Error('Invalid catalogue response.');
      setExtras(extraData as ExtraRow[]);
      setPromotions(promoData as PromotionRow[]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load catalogue.');
    } finally { setLoading(false); }
  }

  useEffect(() => { const initialize = async () => { await loadLists(); }; void initialize(); }, []);

  async function save(endpoint: string, data: unknown) {
    setStatus('Saving…'); setError(''); setBusy(true);
    try {
      const r = await fetch(`/api/admin/premium/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      if (!r.ok) { const b: unknown = await r.json().catch(() => ({})); throw new Error(b && typeof b === 'object' && 'message' in b ? String((b as { message?: unknown }).message) : 'Validation failed'); }
      setStatus('Saved successfully.');
      toast.success('Saved successfully.', 'Premium catalogue');
      await loadLists();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unable to save';
      setError(message);
      toast.error(message, 'Premium catalogue');
    }
    finally { setBusy(false); }
  }

  async function remove(resource: 'extras' | 'promotions', id: string, label: string) {
    const confirmed = await confirm({
      title: 'Delete',
      message: `Delete ${label}? This cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!confirmed) return;
    setStatus(''); setError(''); setBusy(true);
    try {
      const r = await fetch(`/api/admin/premium/${resource}?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!r.ok) { const b: unknown = await r.json().catch(() => ({})); throw new Error(b && typeof b === 'object' && 'message' in b ? String((b as { message?: unknown }).message) : 'Unable to delete'); }
      setStatus('Deleted successfully.');
      toast.success(`Deleted ${label}.`, 'Premium catalogue');
      await loadLists();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unable to delete';
      setError(message);
      toast.error(message, 'Premium catalogue');
    }
    finally { setBusy(false); }
  }

  function editExtra(row: ExtraRow) {
    setExtra({ code: row.code, name: row.name, description: row.description ?? '', category: row.category, pricing: row.pricing, amount: Number(row.amount), enabled: row.enabled });
    setStatus(`Editing extra ${row.code}.`); setError('');
  }

  function editPromotion(row: PromotionRow) {
    setPromo({ code: row.code, percentage: row.percentage, startDate: row.startDate, expiryDate: row.expiryDate, maxUses: row.maxUses ?? 1, enabled: row.enabled });
    setStatus(`Editing promotion ${row.code}.`); setError('');
  }

  return <main className={styles.page}>
    <header className={styles.hero}>
      <p className={styles.eyebrow}>CUSTOMER EXPERIENCES</p>
      <h1 className={styles.title}>Premium services &amp; offers</h1>
      <p className={styles.intro}>Manage optional equipment, protections and promotional codes. All amounts are in EUR.</p>
    </header>
    <div className={styles.grid}>
      <form onSubmit={e => { e.preventDefault(); void save('extras', extra); }}>
        <h2>Extras and protection options</h2>
        <label>Unique code<input required pattern="[A-Z_]{3,40}" value={extra.code} onChange={e => setExtra({ ...extra, code: e.target.value.toUpperCase() })} /></label>
        <label>Label<input required maxLength={100} value={extra.name} onChange={e => setExtra({ ...extra, name: e.target.value })} /></label>
        <label>Description<textarea maxLength={500} value={extra.description} onChange={e => setExtra({ ...extra, description: e.target.value })} /></label>
        <label>Category<select value={extra.category} onChange={e => setExtra({ ...extra, category: e.target.value })}><option value="equipment">Equipment</option><option value="driver">Additional driver</option><option value="protection">Protection</option></select></label>
        <label>Billing<select value={extra.pricing} onChange={e => setExtra({ ...extra, pricing: e.target.value })}><option value="once">One time</option><option value="daily">Per day</option></select></label>
        <label>Price (EUR)<input required type="number" min="0" step="0.01" value={extra.amount} onChange={e => setExtra({ ...extra, amount: Number(e.target.value) })} /></label>
        <label className={styles.check}><input type="checkbox" checked={extra.enabled} onChange={e => setExtra({ ...extra, enabled: e.target.checked })} /> Enabled</label>
        <div className={styles.actions}>
          <button disabled={busy}>Save extra</button>
          <button type="button" className={styles.secondary} onClick={() => setExtra(EMPTY_EXTRA)} disabled={busy}>New extra</button>
        </div>
      </form>
      <form onSubmit={e => { e.preventDefault(); void save('promotions', promo); }}>
        <h2>Promotion codes</h2>
        <label>Code<input required pattern="[A-Z0-9_-]{3,30}" value={promo.code} onChange={e => setPromo({ ...promo, code: e.target.value.toUpperCase() })} /></label>
        <label>Discount (%)<input required type="number" min={1} max={50} value={promo.percentage} onChange={e => setPromo({ ...promo, percentage: Number(e.target.value) })} /></label>
        <label>Valid from<input required type="date" value={promo.startDate} onChange={e => setPromo({ ...promo, startDate: e.target.value })} /></label>
        <label>Valid until (exclusive)<input required type="date" value={promo.expiryDate} onChange={e => setPromo({ ...promo, expiryDate: e.target.value })} /></label>
        <label>Maximum uses<input required type="number" min={1} value={promo.maxUses} onChange={e => setPromo({ ...promo, maxUses: Number(e.target.value) })} /></label>
        <label className={styles.check}><input type="checkbox" checked={promo.enabled} onChange={e => setPromo({ ...promo, enabled: e.target.checked })} /> Enabled</label>
        <div className={styles.actions}>
          <button disabled={busy}>Save promotion</button>
          <button type="button" className={styles.secondary} onClick={() => setPromo(EMPTY_PROMO)} disabled={busy}>New promotion</button>
        </div>
      </form>
    </div>
    {status && <p role="status" className={styles.notice}>{status}</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}

    {loading ? <p role="status">Loading catalogue…</p> : <>
      <section className={styles.catalogue} aria-label="Existing extras">
        <h2 className={styles.catalogueTitle}>Existing extras ({extras.length})</h2>
        {extras.length === 0 ? <p className={styles.empty}>No extras defined yet.</p> : (
          <ul className={styles.rows}>
            {extras.map(row => <li key={row.id} className={styles.row}>
              <div className={styles.rowInfo}>
                <strong>{row.name} <span className={styles.code}>{row.code}</span></strong>
                <small>{row.category} · {row.pricing === 'daily' ? 'per day' : 'one time'} · {row.amount} EUR · {row.enabled ? 'enabled' : 'disabled'}</small>
              </div>
              <div className={styles.rowActions}>
                <button type="button" onClick={() => editExtra(row)} disabled={busy}>Edit</button>
                <button type="button" className={styles.danger} onClick={() => void remove('extras', row.id, `extra ${row.code}`)} disabled={busy}>Delete</button>
              </div>
            </li>)}
          </ul>
        )}
      </section>
      <section className={styles.catalogue} aria-label="Existing promotions">
        <h2 className={styles.catalogueTitle}>Existing promotions ({promotions.length})</h2>
        {promotions.length === 0 ? <p className={styles.empty}>No promotion codes defined yet.</p> : (
          <ul className={styles.rows}>
            {promotions.map(row => <li key={row.code} className={styles.row}>
              <div className={styles.rowInfo}>
                <strong>{row.code} <span className={styles.code}>{row.percentage}%</span></strong>
                <small>{row.startDate} → {row.expiryDate} · {row.uses}{row.maxUses ? `/${row.maxUses}` : ''} uses · {row.enabled ? 'enabled' : 'disabled'}</small>
              </div>
              <div className={styles.rowActions}>
                <button type="button" onClick={() => editPromotion(row)} disabled={busy}>Edit</button>
                <button type="button" className={styles.danger} onClick={() => void remove('promotions', row.code, `promotion ${row.code}`)} disabled={busy}>Delete</button>
              </div>
            </li>)}
          </ul>
        )}
      </section>
    </>}
  </main>;
}
