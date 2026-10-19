import { Injectable } from '@nestjs/common';

export interface RateLimitResult {
  // true si l'appel est autorisé.
  allowed: boolean;
  // Nombre de secondes avant réinitialisation (si refusé).
  retryAfterSeconds: number;
  // Appels restants dans la fenêtre courante.
  remaining: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

// ==========================================================
// COMPTEUR À FENÊTRE FIXE, EN MÉMOIRE
// ==========================================================
//
// Suffisant pour une instance unique. L'horloge est un paramètre
// optionnel (`now`) afin de rendre les tests parfaitement
// déterministes, sans faux minuteurs.
@Injectable()
export class AuthRateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  consume(
    key: string,
    limit: number,
    windowMs: number,
    now: number = Date.now(),
  ): RateLimitResult {
    const existing = this.buckets.get(key);

    // Fenêtre absente ou expirée : on démarre un nouveau compteur.
    if (!existing || existing.resetAt <= now) {
      this.buckets.set(key, {
        count: 1,
        resetAt: now + windowMs,
      });

      return {
        allowed: true,
        retryAfterSeconds: 0,
        remaining: Math.max(0, limit - 1),
      };
    }

    // Limite déjà atteinte dans la fenêtre courante.
    if (existing.count >= limit) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil(
            (existing.resetAt - now) / 1000,
          ),
        ),
        remaining: 0,
      };
    }

    existing.count += 1;

    return {
      allowed: true,
      retryAfterSeconds: 0,
      remaining: Math.max(
        0,
        limit - existing.count,
      ),
    };
  }

  // Réinitialise tous les compteurs (tests / administration).
  reset(): void {
    this.buckets.clear();
  }
}
