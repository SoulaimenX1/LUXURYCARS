import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { FinanceService } from './finance.service.js';

describe('FinanceService state changes', () => {
  it.each(['hold', 'settle', 'charge'] as const)(
    'rejects %s after a concurrent closure, using the state read under the rental lock',
    async operation => {
      // A plain read represents the stale state before a concurrent closure.
      const query = vi.fn(async (sql: string) => {
        if (sql.includes('FROM rentals l JOIN reservations')) {
          return [{ id: 'rental', status: sql.includes('FOR UPDATE OF l') ? 'closed' : operation === 'hold' ? 'active' : 'returned' }];
        }
        return [];
      });
      const service = new FinanceService({
        transaction: (callback: (manager: { query: typeof query }) => unknown) => callback({ query }),
      } as never);
      const result = operation === 'hold'
        ? service.holdDeposit('admin', 'rental', { method: 'cash', reference: 'test' })
        : operation === 'settle'
          ? service.settleDeposit('admin', 'rental', { retainedAmount: 0, method: 'cash', reference: 'test' })
          : service.addCharge('admin', 'rental', { type: 'other', description: 'test', amount: 10 });
      await expect(result).rejects.toBeInstanceOf(ConflictException);
      expect(query.mock.calls.some(([sql]) => sql.includes('INSERT') || sql.includes('UPDATE security_deposits'))).toBe(false);
    },
  );

  it('reports a missing rental before writing a deposit', async () => {
    const query = vi.fn().mockResolvedValue([]);
    const service = new FinanceService({
      transaction: (callback: (manager: { query: typeof query }) => unknown) => callback({ query }),
    } as never);
    await expect(service.holdDeposit('admin', 'missing', { method: 'cash', reference: 'test' }))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(query).toHaveBeenCalledTimes(1);
  });
});
