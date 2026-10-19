'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

// Les prix du catalogue et des réservations sont toujours stockés en EUR.
// La conversion ci-dessous est purement informative et côté navigateur.
export type DisplayCurrency = 'EUR' | 'USD' | 'GBP' | 'CHF' | 'HUF' | 'TND';
export const DISPLAY_CURRENCIES: DisplayCurrency[] = ['EUR', 'USD', 'GBP', 'CHF', 'HUF', 'TND'];
const STORAGE_KEY = 'luxury-display-currency';

interface CurrencyContextValue {
  currency: DisplayCurrency;
  available: DisplayCurrency[];
  asOf: string | null;
  loading: boolean;
  warning: string | null;
  setCurrency: (currency: DisplayCurrency) => void;
  formatPrice: (amount: string | number) => string;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setSelectedCurrency] = useState<DisplayCurrency>('EUR');
  const [rates, setRates] = useState<Record<string, number>>({ EUR: 1 });
  const [asOf, setAsOf] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function loadRates() {
      try {
        const response = await fetch('/api/currency-rates', { signal: controller.signal });
        if (!response.ok) throw new Error('Reference rates unavailable');
        const data: unknown = await response.json();
        if (!data || typeof data !== 'object' || !('rates' in data) ||
            !('asOf' in data) || typeof data.asOf !== 'string') {
          throw new Error('Invalid reference rates');
        }
        const candidate = data.rates as Record<string, unknown>;
        const usable: Record<string, number> = { EUR: 1 };
        for (const code of DISPLAY_CURRENCIES) {
          const rate = candidate[code];
          if (typeof rate === 'number' && Number.isFinite(rate) && rate > 0) usable[code] = rate;
        }
        if (!controller.signal.aborted) {
          setRates(usable);
          setAsOf(data.asOf);
          const saved = localStorage.getItem(STORAGE_KEY);
          if (saved && DISPLAY_CURRENCIES.includes(saved as DisplayCurrency) && usable[saved]) {
            setSelectedCurrency(saved as DisplayCurrency);
          }
        }
      } catch {
        if (!controller.signal.aborted) {
          setWarning('Live exchange rates are unavailable. Showing EUR prices.');
          setSelectedCurrency('EUR');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void loadRates();
    return () => controller.abort();
  }, []);

  const setCurrency = useCallback((next: DisplayCurrency) => {
    if (!rates[next]) return;
    setSelectedCurrency(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* Stockage facultatif. */ }
  }, [rates]);

  const formatPrice = useCallback((amount: string | number): string => {
    const value = typeof amount === 'number' ? amount : Number(amount);
    if (!Number.isFinite(value)) return String(amount);
    const factor = rates[currency];
    // Ne jamais inventer un cours de conversion si l'API échoue.
    const actualCurrency = factor ? currency : 'EUR';
    const safeValue = value * (factor ?? 1);
    return new Intl.NumberFormat('en-GB', {
      style: 'currency', currency: actualCurrency,
      minimumFractionDigits: actualCurrency === 'HUF' ? 0 : 2,
      maximumFractionDigits: actualCurrency === 'HUF' ? 0 : 2,
    }).format(safeValue);
  }, [currency, rates]);

  const value = useMemo<CurrencyContextValue>(() => ({
    currency, available: DISPLAY_CURRENCIES.filter((code) => Boolean(rates[code])),
    asOf, loading, warning, setCurrency, formatPrice,
  }), [currency, rates, asOf, loading, warning, setCurrency, formatPrice]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyContextValue {
  const value = useContext(CurrencyContext);
  if (!value) throw new Error('useCurrency must be used within CurrencyProvider');
  return value;
}

export function Price({ value }: { value: string | number }) {
  const { formatPrice } = useCurrency();
  return <>{formatPrice(value)}</>;
}
