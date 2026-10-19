
import {
    ConflictException,
    UnauthorizedException,
} from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';

import argon2 from 'argon2';

import {
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import {
    UsersService,
} from '../users/users.service.js';

import {
    InboxService,
} from '../notifications/inbox.service.js';

import type {
    CreateCustomerInput,
} from '../users/users.service.js';

// Stub du service de notifications : une connexion ne doit
// jamais échouer si le rappel de permis est indisponible.
function inboxStub() {
    return {
        safelyLicenseRequired: vi
            .fn()
            .mockResolvedValue(undefined),
    } as unknown as InboxService;
}

import {
    AccountStatus,
    User,
    UserRole,
} from '../users/entities/user.entity.js';

import {
    AuthService,
} from './auth.service.js';

describe('AuthService', () => {
    const registerDto = {
        firstName: 'Test',
        lastName: 'Customer',
        email: 'test@example.com',
        password: 'TestPassword2026!',
    };

    // ==========================================
    // TEST 1: SECURE CUSTOMER REGISTRATION
    // ==========================================

    it('should register a customer securely', async () => {
        const createCustomer = vi.fn(
            async (input: CreateCustomerInput): Promise<User> => {
                return {
                    id: '550e8400-e29b-41d4-a716-446655440000',
                    ...input,
                    role: UserRole.CUSTOMER,
                    status: AccountStatus.ACTIVE,
                    createdAt: new Date('2026-10-02T08:00:00Z'),
                } as User;
            },
        );

        const service = new AuthService(
            {
                createCustomer,
            } as unknown as UsersService,
            {
                signAsync: vi.fn(),
            } as unknown as JwtService,
            inboxStub(),
        );

        const result = await service.register(registerDto);

        // Verify that the customer was created
        expect(createCustomer).toHaveBeenCalledOnce();

        // Verify that the password was hashed
        const [input] = createCustomer.mock.calls[0];

        expect(input.passwordHash).not.toBe(
            registerDto.password,
        );

        expect(
            await argon2.verify(
                input.passwordHash,
                registerDto.password,
            ),
        ).toBe(true);

        // Verify that sensitive data is not returned
        expect(result.email).toBe(registerDto.email);

        expect(result.role).toBe(
            UserRole.CUSTOMER,
        );

        expect(result).not.toHaveProperty(
            'password',
        );

        expect(result).not.toHaveProperty(
            'passwordHash',
        );
    });

    // ==========================================
    // TEST 2: DUPLICATE EMAIL
    // ==========================================

    it('should propagate duplicate-email errors', async () => {
        const createCustomer = vi.fn(
            async (): Promise<User> => {
                throw new ConflictException(
                    'An account with this email already exists',
                );
            },
        );

        const service = new AuthService(
            {
                createCustomer,
            } as unknown as UsersService,
            {
                signAsync: vi.fn(),
            } as unknown as JwtService,
            inboxStub(),
        );

        await expect(
            service.register(registerDto),
        ).rejects.toBeInstanceOf(
            ConflictException,
        );
    });

    // ==========================================
    // TEST 3: SUCCESSFUL LOGIN
    // ==========================================

    it('should log in with valid credentials', async () => {
        const passwordHash = await argon2.hash(
            'TestPassword2026!',
        );

        const user = {
            id: '550e8400-e29b-41d4-a716-446655440000',
            firstName: 'Test',
            lastName: 'Customer',
            email: 'test@example.com',
            passwordHash,
            role: UserRole.CUSTOMER,
            status: AccountStatus.ACTIVE,
        } as User;

        const findByEmailForAuth = vi.fn()
            .mockResolvedValue(user);

        const signAsync = vi.fn()
            .mockResolvedValue('test-access-token');

        const service = new AuthService(
            {
                findByEmailForAuth,
            } as unknown as UsersService,
            {
                signAsync,
            } as unknown as JwtService,
            inboxStub(),
        );

        const result = await service.login({
            email: 'test@example.com',
            password: 'TestPassword2026!',
        });

        // Verify JWT generation
        expect(result.accessToken).toBe(
            'test-access-token',
        );

        expect(result.tokenType).toBe(
            'Bearer',
        );

        // Verify user role
        expect(result.user.role).toBe(
            UserRole.CUSTOMER,
        );

        // Verify JWT payload
        expect(signAsync).toHaveBeenCalledWith({
            sub: user.id,
            role: UserRole.CUSTOMER,
        });

        // Verify that sensitive data is not returned
        expect(result).not.toHaveProperty(
            'password',
        );

        expect(result).not.toHaveProperty(
            'passwordHash',
        );
    });

    // ==========================================
    // TEST 4: INCORRECT PASSWORD
    // ==========================================

    it('should reject an incorrect password', async () => {
        const passwordHash = await argon2.hash(
            'CorrectPassword2026!',
        );

        const user = {
            id: '550e8400-e29b-41d4-a716-446655440000',
            email: 'test@example.com',
            passwordHash,
            role: UserRole.CUSTOMER,
            status: AccountStatus.ACTIVE,
        } as User;

        const signAsync = vi.fn();

        const service = new AuthService(
            {
                findByEmailForAuth: vi.fn()
                    .mockResolvedValue(user),
            } as unknown as UsersService,
            {
                signAsync,
            } as unknown as JwtService,
            inboxStub(),
        );

        await expect(
            service.login({
                email: 'test@example.com',
                password: 'WrongPassword123!',
            }),
        ).rejects.toBeInstanceOf(
            UnauthorizedException,
        );

        // JWT must not be generated
        expect(signAsync).not.toHaveBeenCalled();
    });

    // ==========================================
    // TEST 5: UNKNOWN EMAIL
    // ==========================================

    it('should reject an unknown email', async () => {
        const signAsync = vi.fn();

        const service = new AuthService(
            {
                findByEmailForAuth: vi.fn()
                    .mockResolvedValue(null),
            } as unknown as UsersService,
            {
                signAsync,
            } as unknown as JwtService,
            inboxStub(),
        );

        await expect(
            service.login({
                email: 'unknown@example.com',
                password: 'TestPassword2026!',
            }),
        ).rejects.toBeInstanceOf(
            UnauthorizedException,
        );

        // JWT must not be generated
        expect(signAsync).not.toHaveBeenCalled();
    });

    // ==========================================
    // TEST 6: SUSPENDED ACCOUNT
    // ==========================================

    it('should reject a suspended account', async () => {
        const passwordHash = await argon2.hash(
            'TestPassword2026!',
        );

        const user = {
            id: '550e8400-e29b-41d4-a716-446655440000',
            email: 'test@example.com',
            passwordHash,
            role: UserRole.CUSTOMER,
            status: AccountStatus.SUSPENDED,
        } as User;

        const signAsync = vi.fn();

        const service = new AuthService(
            {
                findByEmailForAuth: vi.fn()
                    .mockResolvedValue(user),
            } as unknown as UsersService,
            {
                signAsync,
            } as unknown as JwtService,
            inboxStub(),
        );

        await expect(
            service.login({
                email: 'test@example.com',
                password: 'TestPassword2026!',
            }),
        ).rejects.toBeInstanceOf(
            UnauthorizedException,
        );

        // JWT must not be generated
        expect(signAsync).not.toHaveBeenCalled();
    });

    // ==========================================
    // TEST 7: LICENCE REMINDER ON LOGIN
    // ==========================================

    it('should request a licence reminder when a customer logs in', async () => {
        const passwordHash = await argon2.hash(
            'TestPassword2026!',
        );

        const user = {
            id: '550e8400-e29b-41d4-a716-446655440000',
            email: 'test@example.com',
            passwordHash,
            role: UserRole.CUSTOMER,
            status: AccountStatus.ACTIVE,
        } as User;

        const safelyLicenseRequired = vi
            .fn()
            .mockResolvedValue(undefined);

        const service = new AuthService(
            {
                findByEmailForAuth: vi
                    .fn()
                    .mockResolvedValue(user),
            } as unknown as UsersService,
            {
                signAsync: vi
                    .fn()
                    .mockResolvedValue('test-access-token'),
            } as unknown as JwtService,
            {
                safelyLicenseRequired,
            } as unknown as InboxService,
        );

        await service.login({
            email: 'test@example.com',
            password: 'TestPassword2026!',
        });

        expect(safelyLicenseRequired).toHaveBeenCalledOnce();
        expect(safelyLicenseRequired).toHaveBeenCalledWith(
            user.id,
        );
    });

    it('should not request a licence reminder for an administrator', async () => {
        const passwordHash = await argon2.hash(
            'AdminPass123!',
        );

        const admin = {
            id: '660e8400-e29b-41d4-a716-446655440001',
            email: 'admin@luxury.test',
            passwordHash,
            role: UserRole.ADMIN,
            status: AccountStatus.ACTIVE,
        } as User;

        const safelyLicenseRequired = vi
            .fn()
            .mockResolvedValue(undefined);

        const service = new AuthService(
            {
                findByEmailForAuth: vi
                    .fn()
                    .mockResolvedValue(admin),
            } as unknown as UsersService,
            {
                signAsync: vi
                    .fn()
                    .mockResolvedValue('test-access-token'),
            } as unknown as JwtService,
            {
                safelyLicenseRequired,
            } as unknown as InboxService,
        );

        await service.login({
            email: 'admin@luxury.test',
            password: 'AdminPass123!',
        });

        expect(safelyLicenseRequired).not.toHaveBeenCalled();
    });
});
