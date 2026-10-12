
import {
    UnauthorizedException,
} from '@nestjs/common';

import type {
    ExecutionContext,
} from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';

import {
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import {
    UsersService,
} from '../../users/users.service.js';

import {
    AccountStatus,
    User,
    UserRole,
} from '../../users/entities/user.entity.js';

import {
    JwtAuthGuard,
} from './jwt-auth.guard.js';

import type {
    AuthenticatedUser,
} from './jwt-auth.guard.js';

describe('JwtAuthGuard', () => {
    // Create simulated dependencies
    const createGuard = () => {
        const jwtService = {
            verifyAsync: vi.fn(),
        };

        const usersService = {
            findById: vi.fn(),
        };

        const guard = new JwtAuthGuard(
            jwtService as unknown as JwtService,
            usersService as unknown as UsersService,
        );

        return {
            guard,
            jwtService,
            usersService,
        };
    };

    // Create a simulated HTTP request
    const createContext = (
        authorization?: string,
    ) => {
        const request: {
            headers: {
                authorization?: string;
            };
            user?: AuthenticatedUser;
        } = {
            headers: {
                authorization,
            },
        };

        const context = {
            switchToHttp: () => ({
                getRequest: () => request,
            }),
        } as unknown as ExecutionContext;

        return {
            context,
            request,
        };
    };

    // Simulated customer
    const customer = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        firstName: 'Test',
        lastName: 'Customer',
        email: 'test@example.com',
        role: UserRole.CUSTOMER,
        status: AccountStatus.ACTIVE,
    } as User;

    // ==========================================
    // TEST 1: MISSING JWT
    // ==========================================

    it('should reject a request without a token', async () => {
        const { guard, jwtService } = createGuard();

        const { context } = createContext();

        await expect(
            guard.canActivate(context),
        ).rejects.toBeInstanceOf(
            UnauthorizedException,
        );

        expect(
            jwtService.verifyAsync,
        ).not.toHaveBeenCalled();
    });

    // ==========================================
    // TEST 2: VALID JWT
    // ==========================================

    it('should accept a valid token', async () => {
        const {
            guard,
            jwtService,
            usersService,
        } = createGuard();

        jwtService.verifyAsync.mockResolvedValue({
            sub: customer.id,
            role: UserRole.CUSTOMER,
        });

        usersService.findById.mockResolvedValue(
            customer,
        );

        const { context, request } = createContext(
            'Bearer valid-token',
        );

        const result = await guard.canActivate(
            context,
        );

        expect(result).toBe(true);

        expect(
            usersService.findById,
        ).toHaveBeenCalledWith(
            customer.id,
        );

        expect(request.user).toEqual({
            id: customer.id,
            firstName: customer.firstName,
            lastName: customer.lastName,
            email: customer.email,
            role: UserRole.CUSTOMER,
        });
    });

    // ==========================================
    // TEST 3: INVALID OR EXPIRED JWT
    // ==========================================

    it('should reject an invalid or expired token', async () => {
        const {
            guard,
            jwtService,
            usersService,
        } = createGuard();

        jwtService.verifyAsync.mockRejectedValue(
            new Error('jwt expired'),
        );

        const { context } = createContext(
            'Bearer expired-token',
        );

        await expect(
            guard.canActivate(context),
        ).rejects.toBeInstanceOf(
            UnauthorizedException,
        );

        expect(
            usersService.findById,
        ).not.toHaveBeenCalled();
    });

    // ==========================================
    // TEST 4: SUSPENDED ACCOUNT
    // ==========================================

    it('should reject a suspended account', async () => {
        const {
            guard,
            jwtService,
            usersService,
        } = createGuard();

        jwtService.verifyAsync.mockResolvedValue({
            sub: customer.id,
        });

        usersService.findById.mockResolvedValue({
            id: customer.id,
            firstName: customer.firstName,
            lastName: customer.lastName,
            email: customer.email,
            role: customer.role,
            status: AccountStatus.SUSPENDED,
        } as User);

        const { context } = createContext(
            'Bearer valid-token',
        );

        await expect(
            guard.canActivate(context),
        ).rejects.toBeInstanceOf(
            UnauthorizedException,
        );
    });

    // ==========================================
    // TEST 5: DELETED OR UNKNOWN USER
    // ==========================================

    it('should reject a token for an unknown user', async () => {
        const {
            guard,
            jwtService,
            usersService,
        } = createGuard();

        jwtService.verifyAsync.mockResolvedValue({
            sub: customer.id,
        });

        usersService.findById.mockResolvedValue(
            null,
        );

        const { context } = createContext(
            'Bearer valid-token',
        );

        await expect(
            guard.canActivate(context),
        ).rejects.toBeInstanceOf(
            UnauthorizedException,
        );
    });
});
