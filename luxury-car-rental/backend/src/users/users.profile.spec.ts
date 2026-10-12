
import {
    BadRequestException,
    NotFoundException,
} from '@nestjs/common';

import { Repository } from 'typeorm';

import {
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { UsersService } from './users.service.js';

import {
    User,
    UserRole,
} from './entities/user.entity.js';

describe('UsersService - Profile Management', () => {
    const userId =
        '550e8400-e29b-41d4-a716-446655440000';

    const createTestService = () => {
        const repository = {
            update: vi.fn(),
            findOne: vi.fn(),
        };

        const service = new UsersService(
            repository as unknown as Repository<User>,
        );

        return { service, repository };
    };

    // ==========================================
    // TEST 1: UPDATE PROFILE
    // ==========================================

    it('should update the user profile', async () => {
        const { service, repository } =
            createTestService();

        const updatedUser = {
            id: userId,
            firstName: 'TestUpdated',
            lastName: 'Customer',
            phone: '+21612345678',
            role: UserRole.CUSTOMER,
        } as User;

        repository.update.mockResolvedValue({
            affected: 1,
        });

        repository.findOne.mockResolvedValue(
            updatedUser,
        );

        const result =
            await service.updateMyProfile(userId, {
                firstName: 'TestUpdated',
                phone: '+21612345678',
            });

        expect(repository.update).toHaveBeenCalledWith(
            userId,
            {
                firstName: 'TestUpdated',
                phone: '+21612345678',
            },
        );

        expect(result).toEqual(updatedUser);
    });

    // ==========================================
    // TEST 2: PREVENT ROLE MODIFICATION
    // ==========================================

    it('should never update the user role', async () => {
        const { service, repository } =
            createTestService();

        repository.update.mockResolvedValue({
            affected: 1,
        });

        repository.findOne.mockResolvedValue({
            id: userId,
            firstName: 'NewName',
            role: UserRole.CUSTOMER,
        });

        await service.updateMyProfile(
            userId,
            {
                firstName: 'NewName',
                role: UserRole.ADMIN,
            } as {
                firstName: string;
            },
        );

        expect(repository.update).toHaveBeenCalledWith(
            userId,
            {
                firstName: 'NewName',
            },
        );
    });

    // ==========================================
    // TEST 3: EMPTY UPDATE
    // ==========================================

    it('should reject an empty update', async () => {
        const { service, repository } =
            createTestService();

        await expect(
            service.updateMyProfile(userId, {}),
        ).rejects.toBeInstanceOf(
            BadRequestException,
        );

        expect(repository.update).not.toHaveBeenCalled();
    });

    // ==========================================
    // TEST 4: UNKNOWN USER
    // ==========================================

    it('should reject an unknown user', async () => {
        const { service, repository } =
            createTestService();

        repository.update.mockResolvedValue({
            affected: 0,
        });

        await expect(
            service.updateMyProfile(userId, {
                firstName: 'TestUpdated',
            }),
        ).rejects.toBeInstanceOf(
            NotFoundException,
        );
    });
});
