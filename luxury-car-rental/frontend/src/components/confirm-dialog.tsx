'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import styles from './confirm-dialog.module.css';

// ==========================================================
// CONFIRMATION THÉMÉE
// ----------------------------------------------------------
// Remplace la boîte native window.confirm() par une modale
// aux couleurs de la maison (ivoire, or, encre) affichée sur
// toute la plateforme (client comme administration).
//
// Usage :
//   const confirm = useConfirm();
//   if (!(await confirm({ message: 'Supprimer ?', tone: 'danger' }))) return;
// ==========================================================

export type ConfirmTone = 'default' | 'success' | 'danger';

export interface ConfirmOptions {
  /** Titre affiché ; par défaut « Please confirm ». */
  title?: string;
  /** Message principal (les retours à la ligne sont respectés). */
  message: string;
  /** Libellé du bouton de validation ; par défaut « Confirm ». */
  confirmLabel?: string;
  /** Libellé du bouton d'annulation ; par défaut « Cancel ». */
  cancelLabel?: string;
  /** Accent du bouton de validation. */
  tone?: ConfirmTone;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...options, resolve });
    });
  }, []);

  const close = useCallback((value: boolean) => {
    setPending((current) => {
      current?.resolve(value);
      return null;
    });
  }, []);

  // Focus sur l'action principale, Échap pour annuler, blocage du fond.
  useEffect(() => {
    if (!pending) return;

    confirmButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [pending, close]);

  const tone: ConfirmTone = pending?.tone ?? 'default';

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}

      {pending && (
        <div
          className={styles.overlay}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close(false);
          }}
        >
          <div
            className={styles.dialog}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="luxury-confirm-title"
            aria-describedby="luxury-confirm-message"
          >
            <h2 id="luxury-confirm-title" className={styles.title}>
              {pending.title ?? 'Please confirm'}
            </h2>
            <p id="luxury-confirm-message" className={styles.message}>
              {pending.message}
            </p>

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.cancel}
                onClick={() => close(false)}
              >
                {pending.cancelLabel ?? 'Cancel'}
              </button>
              <button
                type="button"
                ref={confirmButtonRef}
                data-tone={tone}
                className={styles.confirm}
                onClick={() => close(true)}
              >
                {pending.confirmLabel ?? 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const context = useContext(ConfirmContext);

  if (!context) {
    throw new Error('useConfirm must be used inside a ConfirmProvider.');
  }

  return context;
}
