import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  AuthRateLimiter,
} from './auth-rate-limiter.service.js';

// ==========================================================
// TESTS — COMPTEUR DE LIMITATION DE DÉBIT
// ==========================================================
// L'horloge est passée explicitement (`now`) : les tests sont donc
// totalement déterministes, sans faux minuteurs ni attente réelle.
describe('AuthRateLimiter', () => {
  it('autorise jusqu’à la limite puis refuse', () => {
    const limiter = new AuthRateLimiter();
    const now = 1_000_000;

    expect(
      limiter.consume('k', 3, 60_000, now).allowed,
    ).toBe(true);

    expect(
      limiter.consume('k', 3, 60_000, now).allowed,
    ).toBe(true);

    const third = limiter.consume(
      'k',
      3,
      60_000,
      now,
    );

    expect(third.allowed).toBe(true);
    expect(third.remaining).toBe(0);

    const fourth = limiter.consume(
      'k',
      3,
      60_000,
      now,
    );

    expect(fourth.allowed).toBe(false);
    expect(fourth.retryAfterSeconds).toBe(60);
  });

  it('réinitialise le compteur après expiration de la fenêtre', () => {
    const limiter = new AuthRateLimiter();

    expect(
      limiter.consume('k', 1, 1_000, 0).allowed,
    ).toBe(true);

    expect(
      limiter.consume('k', 1, 1_000, 500).allowed,
    ).toBe(false);

    // Nouvelle fenêtre : le compteur repart de zéro.
    expect(
      limiter.consume('k', 1, 1_000, 1_000).allowed,
    ).toBe(true);
  });

  it('isole les compteurs par clé', () => {
    const limiter = new AuthRateLimiter();

    expect(
      limiter.consume('a', 1, 1_000, 0).allowed,
    ).toBe(true);

    expect(
      limiter.consume('b', 1, 1_000, 0).allowed,
    ).toBe(true);

    expect(
      limiter.consume('a', 1, 1_000, 0).allowed,
    ).toBe(false);
  });

  it('réinitialise tous les compteurs via reset()', () => {
    const limiter = new AuthRateLimiter();

    limiter.consume('k', 1, 1_000, 0);
    limiter.reset();

    expect(
      limiter.consume('k', 1, 1_000, 0).allowed,
    ).toBe(true);
  });
});
