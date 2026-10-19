import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AdminCustomersService } from './admin-customers.service.js';
import { AccountStatus, User, UserRole } from '../users/entities/user.entity.js';

// Construit le service avec des repositories simulés.
function buildService(user: Partial<User> | null) {
  const users = {
    find: vi.fn(),
    findOne: vi.fn().mockResolvedValue(user),
    save: vi.fn().mockImplementation((value: User) => Promise.resolve(value)),
  };
  const profiles = { find: vi.fn().mockResolvedValue([]) };
  const reservations = { find: vi.fn().mockResolvedValue([]) };
  const service = new AdminCustomersService(
    users as never,
    profiles as never,
    reservations as never,
  );
  return { service, users };
}

function customer(overrides: Partial<User> = {}): User {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    role: UserRole.CUSTOMER,
    status: AccountStatus.ACTIVE,
    firstName: 'Laszlo',
    lastName: 'Kovacs',
    email: 'laszlo@example.com',
    ...overrides,
  } as User;
}

const ADMIN_ID = '22222222-2222-2222-2222-222222222222';

describe('AdminCustomersService — account status', () => {
  it('suspends an active customer', async () => {
    const { service, users } = buildService(customer());
    const result = await service.suspendCustomer(
      '11111111-1111-1111-1111-111111111111',
      ADMIN_ID,
    );
    expect(result).toEqual({
      id: '11111111-1111-1111-1111-111111111111',
      status: AccountStatus.SUSPENDED,
      changed: true,
    });
    expect(users.save).toHaveBeenCalledTimes(1);
  });

  it('reactivates a suspended customer', async () => {
    const { service } = buildService(customer({ status: AccountStatus.SUSPENDED }));
    const result = await service.reactivateCustomer(
      '11111111-1111-1111-1111-111111111111',
      ADMIN_ID,
    );
    expect(result.status).toBe(AccountStatus.ACTIVE);
    expect(result.changed).toBe(true);
  });

  it('is idempotent when the customer already has the target status', async () => {
    const { service, users } = buildService(customer({ status: AccountStatus.SUSPENDED }));
    const result = await service.suspendCustomer(
      '11111111-1111-1111-1111-111111111111',
      ADMIN_ID,
    );
    expect(result.changed).toBe(false);
    expect(users.save).not.toHaveBeenCalled();
  });

  it('refuses to change an administrator own account', async () => {
    const { service } = buildService(customer());
    await expect(service.suspendCustomer(ADMIN_ID, ADMIN_ID)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('refuses to change a non-customer account', async () => {
    const { service } = buildService(customer({ role: UserRole.STAFF }));
    await expect(
      service.suspendCustomer('11111111-1111-1111-1111-111111111111', ADMIN_ID),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('reports a missing customer', async () => {
    const { service } = buildService(null);
    await expect(
      service.suspendCustomer('11111111-1111-1111-1111-111111111111', ADMIN_ID),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
