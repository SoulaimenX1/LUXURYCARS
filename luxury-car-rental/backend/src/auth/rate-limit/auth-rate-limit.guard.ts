import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';

import {
  Reflector,
} from '@nestjs/core';

import {
  AuthRateLimiter,
} from './auth-rate-limiter.service.js';

import {
  AUTH_RATE_LIMIT_OPTIONS,
  AUTH_RATE_LIMIT_SCOPE_KEY,
} from './auth-rate-limit.options.js';

import type {
  AuthRateLimitOptions,
  AuthRateLimitScope,
} from './auth-rate-limit.options.js';

interface GuardedRequest {
  ip?: string;
  socket?: { remoteAddress?: string };
  body?: { email?: unknown };
}

interface GuardedResponse {
  setHeader?: (
    name: string,
    value: string,
  ) => void;
}

// ==========================================================
// GUARD DE LIMITATION DE DÉBIT (CONNEXION / INSCRIPTION)
// ==========================================================
//
// - L'inscription est limitée par IP (anti-création massive).
// - La connexion est limitée par IP ET par compte (anti-force brute).
//
// En cas de dépassement : HTTP 429 avec en-tête `Retry-After`.
@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  constructor(
    private readonly limiter: AuthRateLimiter,

    private readonly reflector: Reflector,

    @Inject(AUTH_RATE_LIMIT_OPTIONS)
    private readonly options: AuthRateLimitOptions,
  ) {}

  canActivate(
    context: ExecutionContext,
  ): boolean {
    // Un guard sans portée explicite ne limite rien.
    const scope =
      this.reflector.get<AuthRateLimitScope | undefined>(
        AUTH_RATE_LIMIT_SCOPE_KEY,
        context.getHandler(),
      );

    if (!scope) {
      return true;
    }

    const http = context.switchToHttp();

    const request =
      http.getRequest<GuardedRequest>();

    const response =
      http.getResponse<GuardedResponse>();

    const ip = this.clientIp(request);

    const checks: { key: string; limit: number }[] = [];

    if (scope === 'register') {
      checks.push({
        key: `register:ip:${ip}`,
        limit: this.options.registerMaxPerIp,
      });
    } else {
      checks.push({
        key: `login:ip:${ip}`,
        limit: this.options.loginMaxPerIp,
      });

      const email =
        typeof request.body?.email === 'string'
          ? request.body.email.trim().toLowerCase()
          : '';

      if (email) {
        checks.push({
          key: `login:account:${email}`,
          limit: this.options.loginMaxPerAccount,
        });
      }
    }

    for (const check of checks) {
      const result = this.limiter.consume(
        check.key,
        check.limit,
        this.options.windowMs,
      );

      if (!result.allowed) {
        response.setHeader?.(
          'Retry-After',
          String(result.retryAfterSeconds),
        );

        throw new HttpException(
          {
            statusCode:
              HttpStatus.TOO_MANY_REQUESTS,
            error: 'Too Many Requests',
            message:
              'Too many attempts. Please try again later.',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    return true;
  }

  // On n'utilise PAS X-Forwarded-For par défaut : cet en-tête est
  // usurpable tant que l'application n'est pas derrière un proxy de
  // confiance explicitement configuré.
  private clientIp(
    request: GuardedRequest,
  ): string {
    return (
      request.ip ||
      request.socket?.remoteAddress ||
      'unknown'
    );
  }
}
