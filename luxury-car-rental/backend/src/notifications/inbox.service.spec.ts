import { describe, expect, it, vi } from 'vitest';
import type { DataSource } from 'typeorm';
import { InboxService } from './inbox.service.js';
import type { Reservation } from '../reservations/entities/reservation.entity.js';

// Tests unitaires : doubles de PostgreSQL, aucune modification des données réelles.
describe('InboxService — permissions et notifications', () => {
  function service() {
    const query = vi.fn().mockResolvedValue([]);
    return { inbox: new InboxService({ query } as unknown as DataSource), query };
  }

  it('restreint la liste au destinataire JWT et limite la pagination', async () => {
    const { inbox, query } = service();
    await inbox.list('customer-a', 'reservations', true, 99999);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('recipient_id=$1'),
      ['customer-a', 'reservations', true, 3000]);
  });

  it('refuse de marquer l’avis d’un autre utilisateur comme lu', async () => {
    const { inbox, query } = service();
    query.mockResolvedValueOnce([]);
    expect(await inbox.markRead('customer-a','notice-of-b')).toBe(false);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('recipient_id=$2'),
      ['notice-of-b','customer-a']);
  });

  it('emploie des clés de déduplication pour la confirmation', async () => {
    const { inbox, query } = service();
    // 1) notification client, 2) sélection des administrateurs,
    // 3) description de la réservation, 4) notification administrative.
    query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'admin-a' }])
      .mockResolvedValueOnce([{ customerName: 'Ada Lovelace', vehicleName: 'Bentley Continental' }])
      .mockResolvedValueOnce([]);
    const reservation = {
      id:'r-1', customerId:'customer-a', reservationNumber:'RES-2026-000001', decisionReason:null,
    } as Reservation;
    await inbox.reservationEvent('confirmed', reservation);
    expect(query).toHaveBeenNthCalledWith(1,expect.stringContaining('ON CONFLICT(recipient_id,event_key) DO NOTHING'),
      expect.arrayContaining(['reservation:r-1:confirmed:customer']));
    expect(query).toHaveBeenNthCalledWith(4,expect.stringContaining('ON CONFLICT(recipient_id,event_key) DO NOTHING'),
      expect.arrayContaining([
        'reservation:r-1:confirmed:admin',
        'New confirmed reservation',
        '/admin/reservations?focus=RES-2026-000001',
      ]));
  });

  it('ne pousse un avis qu’aux flux du destinataire', async () => {
    const { inbox, query } = service();
    const received: unknown[] = [];
    const unsubscribe = inbox.subscribe('customer-a', (item) => received.push(item));
    query
      .mockResolvedValueOnce([{
        id: 'notice-1', category: 'reservations', priority: 'info',
        title: 'Reservation request received', message: 'Your reservation is awaiting review.',
        action_url: '/account/reservations', read_at: null,
        created_at: new Date('2030-01-01T00:00:00.000Z'),
      }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ customerName: 'Ada', vehicleName: 'Bentley' }])
      .mockResolvedValueOnce([]);
    await inbox.reservationEvent('created', {
      id: 'r-1', customerId: 'customer-a', reservationNumber: 'RES-2026-000001', decisionReason: null,
    } as Reservation);
    unsubscribe();
    // Le flux ne reçoit que l'avis réellement adressé à son destinataire.
    expect(received).toHaveLength(1);
  });

  it('crée un rappel de permis seulement si le profil client est absent', async () => {
    const { inbox, query } = service();
    query.mockResolvedValueOnce([]); // aucun profil client
    await inbox.licenseRequired('customer-a');
    expect(query).toHaveBeenNthCalledWith(1, expect.stringContaining('FROM customer_profiles WHERE user_id=$1'),
      ['customer-a']);
    expect(query).toHaveBeenNthCalledWith(2, expect.stringContaining('ON CONFLICT(recipient_id,event_key) DO NOTHING'),
      expect.arrayContaining(['customer-a', 'security', 'warning', 'Driving licence required']));
  });

  it('n’envoie aucun rappel de permis quand le profil existe', async () => {
    const { inbox, query } = service();
    query.mockResolvedValueOnce([{ '?column?': 1 }]); // profil présent
    await inbox.licenseRequired('customer-a');
    expect(query).toHaveBeenCalledTimes(1);
  });
});
