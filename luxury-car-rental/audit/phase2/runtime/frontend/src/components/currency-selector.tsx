'use client';

import { useEffect, useRef, useState } from 'react';

import { DISPLAY_CURRENCIES, useCurrency } from './currency-provider';
import type { DisplayCurrency } from './currency-provider';
import styles from './currency-selector.module.css';

// Métadonnées d'affichage : symbole officiel et nom de chaque devise.
const CURRENCY_META: Record<DisplayCurrency, { symbol: string; name: string }> = {
  EUR: { symbol: '€', name: 'Euro' },
  USD: { symbol: '$', name: 'US Dollar' },
  GBP: { symbol: '£', name: 'British Pound' },
  CHF: { symbol: 'CHF', name: 'Swiss Franc' },
  HUF: { symbol: 'Ft', name: 'Hungarian Forint' },
  TND: { symbol: 'DT', name: 'Tunisian Dinar' },
};

// Sélecteur de devise premium : menu personnalisé accessible,
// indicateurs visuels (symbole + nom) et statut des taux de change.
export default function CurrencySelector() {
  const { currency, available, asOf, loading, warning, setCurrency } = useCurrency();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fermer le menu au clic extérieur ou avec la touche Échap.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const active = CURRENCY_META[currency];
  const status = loading
    ? 'Loading live exchange rates…'
    : warning ?? (currency === 'EUR' ? 'Prices billed in EUR' : `Indicative rates · ${asOf ?? 'n/a'}`);

  return (
    <div className={styles.container} ref={containerRef}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Display currency: ${currency}. ${status}`}
        title={status}
        disabled={loading}
      >
        <span className={styles.badge} aria-hidden>{active.symbol}</span>
        <span className={styles.code}>{currency}</span>
        <span className={styles.chevron} aria-hidden>▾</span>
      </button>

      {open && (
        <div className={styles.menu}>
          <p className={styles.menuTitle}>Display currency</p>
          <div className={styles.options} role="listbox" aria-label="Select display currency">
            {DISPLAY_CURRENCIES.map((code) => {
              const meta = CURRENCY_META[code];
              const isDisabled = !available.includes(code);
              const isActive = code === currency;
              return (
                <button
                  key={code}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  disabled={isDisabled}
                  className={`${styles.option} ${isActive ? styles.optionActive : ''}`}
                  onClick={() => {
                    if (isDisabled) return;
                    setCurrency(code);
                    setOpen(false);
                  }}
                >
                  <span className={styles.badge} aria-hidden>{meta.symbol}</span>
                  <span className={styles.optionText}>
                    <strong>{code}</strong>
                    <small>{meta.name}</small>
                  </span>
                  {isActive && <span className={styles.check} aria-hidden>✓</span>}
                </button>
              );
            })}
          </div>
          <p className={styles.menuNote} aria-live="polite">{status}</p>
        </div>
      )}
    </div>
  );
}
