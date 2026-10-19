'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useToast } from '@/components/toast';
import styles from './review-popup.module.css';

// ==========================================================
// AVIS APRÈS LOCATION — fenêtre proposée à la connexion
// ----------------------------------------------------------
// Dès qu'un client connecté a une location terminée non encore
// évaluée, une fenêtre élégante s'ouvre automatiquement et
// l'invite à donner son avis :
//   • un avis VOITURE   (note + titre + commentaire) ;
//   • un avis SERVICE   (note + commentaire), proposé uniquement
//     lorsque la réservation a inclus des services optionnels
//     (options et/ou livraison payante).
// Aucune donnée n'est inventée : le formulaire se nourrit des
// réservations réellement éligibles renvoyées par l'API.
// ==========================================================

interface Reviewable {
  reservationNumber: string;
  vehicleId: string;
  closedAt: string;
  vehicleLabel: string | null;
  hasServices: boolean;
  services: string[];
}

export default function ReviewPopup() {
  const toast = useToast();

  const [queue, setQueue] = useState<Reviewable[]>([]);
  const [open, setOpen] = useState(false);

  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [serviceRating, setServiceRating] = useState(5);
  const [serviceComment, setServiceComment] = useState('');

  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');

  const dialogRef = useRef<HTMLDivElement>(null);
  const current = queue[0] ?? null;
  const total = queue.length;

  // ----------------------------------------------------------
  // Chargement des réservations éligibles (une seule fois, à
  // l'ouverture de l'espace client — donc après connexion).
  // ----------------------------------------------------------
  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const response = await fetch('/api/premium/me/reviewable', {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!response.ok) return; // Non connecté : rien à afficher.
        const rows: Reviewable[] = await response.json();
        if (controller.signal.aborted) return;
        if (Array.isArray(rows) && rows.length > 0) {
          setQueue(rows);
          setOpen(true);
        }
      } catch {
        // Silencieux : une fenêtre d'avis ne doit jamais gêner la navigation.
      }
    }

    void load();
    return () => controller.abort();
  }, []);

  // ----------------------------------------------------------
  // Accessibilité : fermeture par Échap, focus, blocage du fond.
  // ----------------------------------------------------------
  useEffect(() => {
    if (!open) return;

    dialogRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
      }
    }

    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const resetForm = useCallback(() => {
    setRating(5);
    setTitle('');
    setComment('');
    setServiceRating(5);
    setServiceComment('');
    setProblem('');
  }, []);

  const close = useCallback(() => {
    setProblem('');
    setOpen(false);
  }, []);

  const vehicleName = useMemo(
    () => current?.vehicleLabel ?? current?.vehicleId.slice(0, 8) ?? '',
    [current],
  );

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!current) return;

    setProblem('');
    setBusy(true);
    try {
      const payload: {
        reservationNumber: string;
        rating: number;
        title: string;
        comment: string;
        serviceRating?: number;
        serviceComment?: string;
      } = {
        reservationNumber: current.reservationNumber,
        rating,
        title: title.trim(),
        comment: comment.trim(),
      };

      if (current.hasServices) {
        payload.serviceRating = serviceRating;
        payload.serviceComment = serviceComment.trim();
      }

      const response = await fetch('/api/premium/me/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ message: 'Unable to save review' }));
        setProblem(typeof data.message === 'string' ? data.message : 'Unable to save review');
        return;
      }

      toast.success('Thank you. Your review has been published.', 'Review');

      const remaining = queue.slice(1);
      setQueue(remaining);
      resetForm();
      if (remaining.length === 0) setOpen(false);
    } catch {
      setProblem('Unable to save review');
    } finally {
      setBusy(false);
    }
  }

  if (!open || !current) return null;

  return (
    <div className={styles.overlay}>
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-popup-title"
        tabIndex={-1}
      >
        <button
          type="button"
          className={styles.close}
          aria-label="Close review window"
          onClick={close}
        >
          {'\u00d7'}
        </button>

        <p className={styles.eyebrow}>YOUR OPINION MATTERS</p>
        <h2 id="review-popup-title" className={styles.heading}>
          How was your experience?
        </h2>
        <p className={styles.lead}>
          Your rental is complete — tell us about the vehicle
          {current.hasServices ? ' and the services you booked' : ''}.
        </p>

        <div className={styles.context}>
          <span className={styles.contextVehicle}>{vehicleName}</span>
          <span className={styles.contextMeta}>
            {current.reservationNumber}
            {total > 1 ? ` · ${total} rentals to review` : ''}
          </span>
        </div>

        <form className={styles.form} onSubmit={(event) => void submit(event)}>
          <fieldset className={styles.section}>
            <legend>About the vehicle</legend>

            <label className={styles.field}>
              <span>Rating</span>
              <select
                value={rating}
                onChange={(event) => setRating(Number(event.target.value))}
              >
                {[5, 4, 3, 2, 1].map((value) => (
                  <option key={value} value={value}>
                    {value} star{value > 1 ? 's' : ''}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span>Title</span>
              <input
                required
                minLength={3}
                maxLength={100}
                placeholder="A memorable drive"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>

            <label className={styles.field}>
              <span>Your experience</span>
              <textarea
                required
                minLength={10}
                maxLength={1500}
                rows={4}
                placeholder="Share what stood out during your rental."
                value={comment}
                onChange={(event) => setComment(event.target.value)}
              />
            </label>
          </fieldset>

          {current.hasServices ? (
            <fieldset className={styles.section}>
              <legend>About the services</legend>

              {current.services.length > 0 ? (
                <ul className={styles.services}>
                  {current.services.map((service) => (
                    <li key={service} className={styles.service}>
                      {service}
                    </li>
                  ))}
                </ul>
              ) : null}

              <label className={styles.field}>
                <span>Service rating</span>
                <select
                  value={serviceRating}
                  onChange={(event) => setServiceRating(Number(event.target.value))}
                >
                  {[5, 4, 3, 2, 1].map((value) => (
                    <option key={value} value={value}>
                      {value} star{value > 1 ? 's' : ''}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.field}>
                <span>Your opinion on the service</span>
                <textarea
                  required
                  minLength={10}
                  maxLength={1500}
                  rows={3}
                  placeholder="How did our team and optional services do?"
                  value={serviceComment}
                  onChange={(event) => setServiceComment(event.target.value)}
                />
              </label>
            </fieldset>
          ) : null}

          {problem ? (
            <p className={styles.problem} role="alert">
              {problem}
            </p>
          ) : null}

          <div className={styles.actions}>
            <button type="button" className={styles.later} onClick={close}>
              Later
            </button>
            <button type="submit" className={styles.submit} disabled={busy}>
              {busy ? 'Publishing…' : 'Publish review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
