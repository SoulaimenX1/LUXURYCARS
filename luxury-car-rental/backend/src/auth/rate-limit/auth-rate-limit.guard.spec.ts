import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  HttpException,
  HttpStatus,
} from '@nestjs/common';

import type {
  ExecutionContext,
} from '@nestjs/common';

import type {
  Reflector,
} from '@nestjs/core';

import {
  AuthRateLimiter,
} from './auth-rate-limiter.service.js';

import {
  AuthRateLimitGuard,
} from './auth-rate-limit.guard.js';

import type {
  AuthRateLimitOptions,
  AuthRateLimitScope,
} from './auth-rate-limit.options.js';

// ==========================================================
// TESTS — GUARD DE LIMITATION DE DÉBIT
// ==========================================================

const TEST_OPTIONS: AuthRateLimitOptions = {
  windowMs: 60_000,
  registerMaxPerIp: 2,
  loginMaxPerIp: 100,
  loginMaxPerAccount: 2,
};

function makeContext(request: unknown) {
  const responseHeaders: Record<string, string> = {};

  const response = {
    setHeader: (name: string, value: string) => {
      responseHeaders[name] = value;
    },
  };

  const context = {
    getHandler: () => function handler() { },
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;

  return { context, responseHeaders };
}

function makeGuard(
  scope: AuthRateLimitScope | undefined,
): AuthRateLimitGuard {
  const reflector = {
    get: () => scope,
  } as unknown as Reflector;

  return new AuthRateLimitGuard(
    new AuthRateLimiter(),
    reflector,
    TEST_OPTIONS,
  );
}

describe('AuthRateLimitGuard', () => {
  it('ne limite rien sans portée explicite', () => {
    const guard = makeGuard(undefined);
    const { context } = makeContext({
      ip: '10.0.0.1',
      body: {},
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('limite les inscriptions par IP (429 + Retry-After)', () => {
    const guard = makeGuard('register');

    const first = makeContext({
      ip: '10.0.0.2',
      body: {},
    });

    const second = makeContext({
      ip: '10.0.0.2',
      body: {},
    });

    const third = makeContext({
      ip: '10.0.0.2',
      body: {},
    });

    expect(guard.canActivate(first.context)).toBe(
      true,
    );

    expect(guard.canActivate(second.context)).toBe(
      true,
    );

    let caught: unknown;

    try {
      guard.canActivate(third.context);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(HttpException);
    expect(
      (caught as HttpException).getStatus(),
    ).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect(
      third.responseHeaders['Retry-After'],
    ).toBeDefined();
  });

  it('limite la connexion par compte, indépendamment de l’IP', () => {
    const guard = makeGuard('login');

    const attempt = (ip: string, email: string) =>
      makeContext({ ip, body: { email } });

    // Deux tentatives pour le même compte, depuis deux IP.
    expect(
      guard.canActivate(
        attempt('10.0.0.3', 'target@example.com')
          .context,
      ),
    ).toBe(true);

    expect(
      guard.canActivate(
        attempt('10.0.0.4', 'target@example.com')
          .context,
      ),
    ).toBe(true);

    // Troisième tentative : refusée par la limite de compte.
    expect(() =>
      guard.canActivate(
        attempt(
          '10.0.0.5',
          'target@example.com',
        ).context,
      ),
    ).toThrow(HttpException);

    // Un autre compte n'est pas affecté.
    expect(
      guard.canActivate(
        attempt('10.0.0.5', 'other@example.com')
          .context,
      ),
    ).toBe(true);
  });

  it('retombe sur socket.remoteAddress quand ip est absent', () => {
    const guard = makeGuard('register');

    const context = makeContext({
      socket: { remoteAddress: '192.168.0.9' },
      body: {},
    });

    expect(guard.canActivate(context.context)).toBe(
      true,
    );
  });
});
