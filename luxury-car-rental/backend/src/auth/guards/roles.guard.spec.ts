
import {
    ForbiddenException,
    UnauthorizedException,
} from '@nestjs/common';

import type {
    ExecutionContext,
} from '@nestjs/common';

import { Reflector } from '@nestjs/core';

import {
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import {
    UserRole,
} from '../../users/entities/user.entity.js';

import type {
    AuthenticatedUser,
} from './jwt-auth.guard.js';

import { RolesGuard } from './roles.guard.js';

describe('RolesGuard', () => {
    // Create a RolesGuard with the required roles
    const createGuard = (roles: UserRole[]) => {
        const reflector = {
            getAllAndOverride: vi.fn()
                .mockReturnValue(roles),
        } as unknown as Reflector;

        return new RolesGuard(reflector);
    };

    // Simulate an HTTP request
    const createContext = (
        role?: UserRole,
    ): ExecutionContext => {
        const user = role
            ? ({
                id: 'test-user-id',
                role,
            } as AuthenticatedUser)
            : undefined;

        return {
            getHandler: () => () => undefined,

            getClass: () => class TestController { },

            switchToHttp: () => ({
                getRequest: () => ({ user }),
            }),
        } as unknown as ExecutionContext;
    };

    // ==========================================
    // TEST 1: UNAUTHENTICATED USER
    // ==========================================

    it('should reject an unauthenticated user', () => {
        const guard = createGuard([
            UserRole.ADMIN,
        ]);

        expect(() =>
            guard.canActivate(createContext()),
        ).toThrow(UnauthorizedException);
    });

    // ==========================================
    // TEST 2: CUSTOMER ACCESS DENIED
    // ==========================================

    it('should deny a customer access to an admin route', () => {
        const guard = createGuard([
            UserRole.ADMIN,
        ]);

        expect(() =>
            guard.canActivate(
                createContext(UserRole.CUSTOMER),
            ),
        ).toThrow(ForbiddenException);
    });

    // ==========================================
    // TEST 3: ADMIN ACCESS GRANTED
    // ==========================================

    it('should allow an admin to access an admin route', () => {
        const guard = createGuard([
            UserRole.ADMIN,
        ]);

        const result = guard.canActivate(
            createContext(UserRole.ADMIN),
        );

        expect(result).toBe(true);
    });

    // ==========================================
    // TEST 4: NO ROLE RESTRICTION
    // ==========================================

    it('should allow access when no specific role is required', () => {
        const guard = createGuard([]);

        const result = guard.canActivate(
            createContext(UserRole.CUSTOMER),
        );

        expect(result).toBe(true);
    });
});
