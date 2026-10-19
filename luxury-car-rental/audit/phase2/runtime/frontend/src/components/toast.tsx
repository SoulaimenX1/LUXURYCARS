'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import styles from './toast.module.css';

// ==========================================================
// NOTIFICATIONS VOLANTES (toasts)
// ==========================================================
//
// Un hote unique, monte a la racine, sert le site client ET
// l'administration. Il complete la modale de confirmation
// (confirm-dialog) pour signaler chaque action importante :
// succes, information, erreur.
//
//   const toast = useToast();
//   toast.success('Vehicle activated.');
//   toast.error('Unable to reach the server.');

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastOptions {
  tone?: ToastTone;
  title?: string;
  message: string;
  durationMs?: number;
}

interface ToastRecord {
  id: number;
  tone: ToastTone;
  title?: string;
  message: string;
  durationMs: number;
}

export interface ToastApi {
  show: (options: ToastOptions | string, tone?: ToastTone) => number;
  success: (message: string, title?: string) => number;
  error: (message: string, title?: string) => number;
  info: (message: string, title?: string) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const DEFAULT_DURATION = 5200;
const ERROR_DURATION = 7600;
const MAX_VISIBLE = 4;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const show = useCallback<ToastApi['show']>((options, tone) => {
    const normalized: ToastOptions =
      typeof options === 'string'
        ? { message: options, tone: tone ?? 'info' }
        : options;

    const id = nextId.current++;
    const record: ToastRecord = {
      id,
      tone: normalized.tone ?? 'info',
      title: normalized.title,
      message: normalized.message,
      durationMs:
        normalized.durationMs ??
        (normalized.tone === 'error' ? ERROR_DURATION : DEFAULT_DURATION),
    };

    setToasts((current) => [...current, record].slice(-MAX_VISIBLE));
    return id;
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (message, title) => show({ message, title, tone: 'success' }),
      error: (message, title) => show({ message, title, tone: 'error' }),
      info: (message, title) => show({ message, title, tone: 'info' }),
      dismiss,
    }),
    [show, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}

      <div className={styles.viewport} role="region" aria-label="Notifications">
        <ol className={styles.list} aria-live="polite" aria-relevant="additions">
          {toasts.map((item) => (
            <ToastItem key={item.id} toast={item} onDismiss={dismiss} />
          ))}
        </ol>
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastRecord;
  onDismiss: (id: number) => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(toast.id), toast.durationMs);
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.durationMs, onDismiss]);

  return (
    <li
      className={styles.toast}
      data-tone={toast.tone}
      role={toast.tone === 'error' ? 'alert' : 'status'}
    >
      <span className={styles.marker} aria-hidden="true" />

      <div className={styles.body}>
        {toast.title ? <p className={styles.title}>{toast.title}</p> : null}
        <p className={styles.message}>{toast.message}</p>
      </div>

      <button
        type="button"
        className={styles.close}
        aria-label="Dismiss notification"
        onClick={() => onDismiss(toast.id)}
      >
        {'\u00d7'}
      </button>
    </li>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used inside a ToastProvider.');
  }

  return context;
}