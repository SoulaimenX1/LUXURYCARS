
import { Repository } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import { User } from './entities/user.entity.js';
import { UsersService } from './users.service.js';

describe('UsersService', () => {
    const mockRepository = {
        findOne: vi.fn(),
    };

    const service = new UsersService(
        mockRepository as unknown as Repository<User>,
    );

    const mockUser = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
    } as User;

    it('should find a user by ID', async () => {
        mockRepository.findOne.mockResolvedValueOnce(mockUser);

        const result = await service.findById(mockUser.id);

        expect(result).toEqual(mockUser);
        expect(mockRepository.findOne).toHaveBeenCalledWith({
            where: { id: mockUser.id },
        });
    });

    it('should find a user by email', async () => {
        mockRepository.findOne.mockResolvedValueOnce(mockUser);

        const result = await service.findByEmail(mockUser.email);

        expect(result).toEqual(mockUser);
        expect(mockRepository.findOne).toHaveBeenCalledWith({
            where: { email: mockUser.email },
        });
    });

    it('should return null if user does not exist', async () => {
        mockRepository.findOne.mockResolvedValueOnce(null);

        const result = await service.findById('unknown-id');

        expect(result).toBeNull();
    });
});
