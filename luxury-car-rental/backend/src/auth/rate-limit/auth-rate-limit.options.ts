import { SetMetadata } from '@nestjs/common';

// ==========================================================
// LIMITATION DE DÉBIT DE L'AUTHENTIFICATION — OPTIONS
// ==========================================================
//
// Implémentation volontairement sans dépendance externe : le
// comportement est ainsi entièrement déterministe et testable,
// sans risque d'incompatibilité de version avec NestJS 12.

// Jeton d'injection des options de limitation.
export const AUTH_RATE_LIMIT_OPTIONS = Symbol('AUTH_RATE_LIMIT_OPTIONS');

// Portée de la limitation : connexion ou inscription.
export type AuthRateLimitScope = 'login' | 'register';

// Clé de métadonnées associant une portée à un handler.
export const AUTH_RATE_LIMIT_SCOPE_KEY = 'authRateLimitScope';

// Décorateur appliqué sur les handlers concernés.
export const AuthRateLimit = (scope: AuthRateLimitScope) =>
  SetMetadata(AUTH_RATE_LIMIT_SCOPE_KEY, scope);

export interface AuthRateLimitOptions {
  // Durée de la fenêtre, en millisecondes.
  windowMs: number;
  // Inscriptions autorisées par IP et par fenêtre.
  registerMaxPerIp: number;
  // Tentatives de connexion autorisées par IP et par fenêtre.
  loginMaxPerIp: number;
  // Tentatives de connexion autorisées par compte (email) et par fenêtre.
  loginMaxPerAccount: number;
}

// Valeurs par défaut raisonnables pour la production.
export const DEFAULT_AUTH_RATE_LIMIT_OPTIONS: AuthRateLimitOptions = {
  windowMs: 60_000,
  registerMaxPerIp: 5,
  loginMaxPerIp: 20,
  loginMaxPerAccount: 5,
};

function positiveInt(
  raw: string | undefined,
  fallback: number,
): number {
  const value = Number(raw);
  return Number.isInteger(value) && value > 0
    ? value
    : fallback;
}

// Construit les options depuis l'environnement en retombant
// sur les valeurs par défaut si une variable est absente/invalide.
export function authRateLimitOptionsFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): AuthRateLimitOptions {
  return {
    windowMs: positiveInt(
      env.AUTH_RATE_LIMIT_WINDOW_MS,
      DEFAULT_AUTH_RATE_LIMIT_OPTIONS.windowMs,
    ),
    registerMaxPerIp: positiveInt(
      env.AUTH_RATE_LIMIT_REGISTER_MAX,
      DEFAULT_AUTH_RATE_LIMIT_OPTIONS.registerMaxPerIp,
    ),
    loginMaxPerIp: positiveInt(
      env.AUTH_RATE_LIMIT_LOGIN_IP_MAX,
      DEFAULT_AUTH_RATE_LIMIT_OPTIONS.loginMaxPerIp,
    ),
    loginMaxPerAccount: positiveInt(
      env.AUTH_RATE_LIMIT_LOGIN_ACCOUNT_MAX,
      DEFAULT_AUTH_RATE_LIMIT_OPTIONS.loginMaxPerAccount,
    ),
  };
}
