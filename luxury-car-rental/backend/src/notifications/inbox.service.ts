import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { Reservation } from '../reservations/entities/reservation.entity.js';

type NoticeCategory = 'reservations' | 'rentals' | 'payments' | 'security' | 'fleet' | 'general';
type NoticePriority = 'info' | 'success' | 'warning' | 'critical';
type ReservationEvent = 'created' | 'confirmed' | 'rejected' | 'cancelled';

export interface InboxItem {
  id: string;
  category: NoticeCategory;
  priority: NoticePriority;
  title: string;
  message: string;
  actionUrl: string | null;
  readAt: string | null;
  createdAt: string;
}

@Injectable()
export class InboxService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InboxService.name);
  private timer: ReturnType<typeof setInterval> | undefined;
  private running = false;

  // Diffusion temps réel (Server-Sent Events).
  // Un ensemble d'écouteurs par destinataire : un abonné ne reçoit
  // JAMAIS les avis d'un autre utilisateur. Le suivi est en mémoire :
  // PostgreSQL reste la source de vérité persistante (rejouable après
  // reconnexion via GET /notifications/inbox).
  private readonly listeners = new Map<string, Set<(item: InboxItem) => void>>();

  constructor(private readonly db: DataSource) {}

  // Abonnement au flux d'un utilisateur. La fonction retournée
  // supprime l'abonnement (appelée à la fermeture du flux SSE).
  subscribe(userId: string, listener: (item: InboxItem) => void): () => void {
    let listeners = this.listeners.get(userId);
    if (!listeners) {
      listeners = new Set();
      this.listeners.set(userId, listeners);
    }
    listeners.add(listener);
    return () => {
      const current = this.listeners.get(userId);
      if (!current) return;
      current.delete(listener);
      if (current.size === 0) this.listeners.delete(userId);
    };
  }

  // Envoyer un avis uniquement aux flux de SON destinataire.
  private publish(userId: string, item: InboxItem): void {
    const listeners = this.listeners.get(userId);
    if (!listeners) return;
    for (const listener of listeners) {
      try {
        listener(item);
      } catch (error) {
        this.logger.warn(`Notification stream listener failed: ${String(error)}`);
      }
    }
  }

  // La pagination est bornée côté serveur : jamais de lecture globale des comptes.
  async list(userId: string, category: string, unread: boolean, offset: number): Promise<InboxItem[]> {
    const categories = new Set(['all', 'reservations', 'rentals', 'payments', 'security', 'fleet', 'general']);
    const selected = categories.has(category) ? category : 'all';
    const rows = await this.db.query(`
      SELECT id,category,priority,title,message,action_url AS "actionUrl",
             read_at AS "readAt",created_at AS "createdAt"
      FROM user_notifications
      WHERE recipient_id=$1 AND archived_at IS NULL
        AND ($2::text='all' OR category=$2)
        AND ($3::boolean=false OR read_at IS NULL)
      ORDER BY created_at DESC,id DESC LIMIT 30 OFFSET $4`,
      [userId, selected, unread, Math.min(Math.max(offset, 0), 3000)]);
    return rows as InboxItem[];
  }

  async unreadCount(userId: string): Promise<number> {
    const rows = await this.db.query(`SELECT count(*)::int AS total FROM user_notifications
      WHERE recipient_id=$1 AND read_at IS NULL AND archived_at IS NULL`, [userId]);
    return Number(rows[0]?.total ?? 0);
  }

  async markRead(userId: string, id: string): Promise<boolean> {
    // TypeORM 1.x : un UPDATE ... RETURNING renvoie [lignes, nombre affecté].
    const result = await this.db.query(`UPDATE user_notifications SET read_at=coalesce(read_at,now())
      WHERE id=$1 AND recipient_id=$2 AND archived_at IS NULL RETURNING id`, [id, userId]);
    const rows: { id: string }[] = Array.isArray(result?.[0]) ? result[0] : result;
    return rows.length > 0;
  }

  async readAll(userId: string): Promise<void> {
    await this.db.query(`UPDATE user_notifications SET read_at=now()
      WHERE recipient_id=$1 AND read_at IS NULL AND archived_at IS NULL`, [userId]);
  }

  async archive(userId: string, id: string): Promise<boolean> {
    // TypeORM 1.x : un UPDATE ... RETURNING renvoie [lignes, nombre affecté].
    const result = await this.db.query(`UPDATE user_notifications SET archived_at=now()
      WHERE id=$1 AND recipient_id=$2 AND archived_at IS NULL RETURNING id`, [id, userId]);
    const rows: { id: string }[] = Array.isArray(result?.[0]) ? result[0] : result;
    return rows.length > 0;
  }

  async preferences(userId: string) {
    const rows = await this.db.query(`SELECT booking_updates AS "bookingUpdates",
      rental_reminders AS "rentalReminders",fleet_news AS "fleetNews",
      email_enabled AS "emailEnabled" FROM notification_preferences WHERE user_id=$1`, [userId]);
    return rows[0] ?? { bookingUpdates: true, rentalReminders: true, fleetNews: true, emailEnabled: false };
  }

  async updatePreferences(userId: string, values: {
    bookingUpdates: boolean; rentalReminders: boolean; fleetNews: boolean; emailEnabled: boolean;
  }) {
    await this.db.query(`INSERT INTO notification_preferences
      (user_id,booking_updates,rental_reminders,fleet_news,email_enabled)
      VALUES($1,$2,$3,$4,$5)
      ON CONFLICT(user_id) DO UPDATE SET booking_updates=EXCLUDED.booking_updates,
      rental_reminders=EXCLUDED.rental_reminders,fleet_news=EXCLUDED.fleet_news,
      email_enabled=EXCLUDED.email_enabled,updated_at=now()`,
      [userId,values.bookingUpdates,values.rentalReminders,values.fleetNews,values.emailEnabled]);
    return this.preferences(userId);
  }

  private async insert(recipientId: string, category: NoticeCategory, priority: NoticePriority,
    title: string, message: string, url: string, eventKey: string, entityId: string | null): Promise<void> {
    // ON CONFLICT : plusieurs tentatives (ou instances) ne produisent pas de doublons.
    // Les paramètres sont castés explicitement : PostgreSQL ne doit pas
    // déduire un type différent pour un même paramètre réutilisé ($2).
    const rows: {
      id: string;
      category: NoticeCategory;
      priority: NoticePriority;
      title: string;
      message: string;
      action_url: string | null;
      read_at: Date | null;
      created_at: Date;
    }[] = await this.db.query(`INSERT INTO user_notifications
      (recipient_id,category,priority,title,message,action_url,event_key,entity_type,entity_id)
      SELECT id,$2::varchar,$3::varchar,$4::varchar,$5::text,$6::varchar,$7::varchar,
        CASE WHEN $8::uuid IS NULL THEN NULL ELSE 'reservation' END,$8::uuid
      FROM users WHERE id=$1::uuid AND status='active'
        AND (
          ($2::text='reservations' AND (SELECT booking_updates FROM notification_preferences WHERE user_id=users.id) IS DISTINCT FROM false)
          OR ($2::text='rentals' AND (SELECT rental_reminders FROM notification_preferences WHERE user_id=users.id) IS DISTINCT FROM false)
          OR ($2::text='fleet' AND (SELECT fleet_news FROM notification_preferences WHERE user_id=users.id) IS DISTINCT FROM false)
          OR ($2::text NOT IN ('reservations','rentals','fleet'))
        )
      ON CONFLICT(recipient_id,event_key) DO NOTHING
      RETURNING id,category,priority,title,message,action_url,read_at,created_at`,
      [recipientId,category,priority,title,message,url,eventKey,entityId]);

    // Temps réel : pousser uniquement une ligne RÉELLEMENT créée
    // (ON CONFLICT ... DO NOTHING ne renvoie aucune ligne en cas de
    // doublon). Les données sont filtrées par destinataire : un flux
    // ne peut jamais recevoir les avis d'un autre utilisateur.
    const created = rows[0];
    if (created) {
      this.publish(recipientId, {
        id: created.id,
        category: created.category,
        priority: created.priority,
        title: created.title,
        message: created.message,
        actionUrl: created.action_url,
        readAt: created.read_at ? new Date(created.read_at).toISOString() : null,
        createdAt: new Date(created.created_at).toISOString(),
      });
    }
  }

  // Décrit une réservation pour une notification administrative :
  // nom du client et véhicule (marque + modèle). Lecture seule,
  // aucune donnée sensible n'est exposée.
  private async describeReservation(
    reservation: Reservation,
  ): Promise<{ customerName: string; vehicleName: string }> {
    const rows: { customerName: string | null; vehicleName: string | null }[] =
      await this.db.query(
        `SELECT TRIM(CONCAT(u.first_name, ' ', u.last_name)) AS "customerName",
                TRIM(CONCAT(b.name, ' ', m.name)) AS "vehicleName"
         FROM reservations r
         LEFT JOIN users u ON u.id = r.customer_id
         LEFT JOIN vehicles v ON v.id = r.vehicle_id
         LEFT JOIN vehicle_models m ON m.id = v.model_id
         LEFT JOIN brands b ON b.id = m.brand_id
         WHERE r.id = $1::uuid`,
        [reservation.id],
      );
    return {
      customerName: rows[0]?.customerName?.trim() || 'A customer',
      vehicleName: rows[0]?.vehicleName?.trim() || 'a vehicle',
    };
  }

  // À appeler UNIQUEMENT après le commit de la réservation.
  async reservationEvent(event: ReservationEvent, reservation: Reservation): Promise<void> {
    const number = reservation.reservationNumber;
    const reason = event === 'rejected' ? ` Reason: ${reservation.decisionReason || 'Not specified'}.` : '';
    const map: Record<ReservationEvent, { title: string; message: string; priority: NoticePriority }> = {
      created: { title: 'Reservation request received', message: `Your reservation ${number} is awaiting review.`, priority: 'info' },
      confirmed: { title: 'Reservation confirmed', message: `Your reservation ${number} has been confirmed.`, priority: 'success' },
      rejected: { title: 'Reservation declined', message: `Your reservation ${number} was declined.${reason}`, priority: 'warning' },
      cancelled: { title: 'Reservation cancelled', message: `Reservation ${number} has been cancelled.`, priority: 'warning' },
    };
    const notification = map[event];
    await this.insert(reservation.customerId, 'reservations', notification.priority,
      notification.title, notification.message, '/account/reservations',
      `reservation:${reservation.id}:${event}:customer`, reservation.id);

    const admins: { id: string }[] = await this.db.query(
      `SELECT id FROM users WHERE role='admin' AND status='active'`);
    if (!admins.length) return;

    // Notification administrative enrichie : qui a réservé quel véhicule.
    // Le lien cible la réservation précise (focus) pour qu'un clic ouvre
    // directement la bonne fiche dans la gestion des réservations.
    const { customerName, vehicleName } =
      await this.describeReservation(reservation);
    const adminMap: Record<ReservationEvent, { title: string; message: string; priority: NoticePriority }> = {
      created: {
        title: 'New reservation request',
        message: `${customerName} requested ${vehicleName} — reservation ${number}.`,
        priority: 'info',
      },
      confirmed: {
        title: 'New confirmed reservation',
        message: `${customerName} confirmed ${vehicleName} — reservation ${number}.`,
        priority: 'success',
      },
      rejected: {
        title: 'Reservation declined',
        message: `Reservation ${number} for ${customerName} was declined.`,
        priority: 'warning',
      },
      cancelled: {
        title: 'Reservation cancelled',
        message: `Reservation ${number} for ${customerName} was cancelled.`,
        priority: 'warning',
      },
    };
    const adminNotice = adminMap[event];
    const focusUrl =
      `/admin/reservations?focus=${encodeURIComponent(number)}`;
    for (const admin of admins) {
      await this.insert(admin.id, 'reservations', adminNotice.priority,
        adminNotice.title, adminNotice.message, focusUrl,
        `reservation:${reservation.id}:${event}:admin`, reservation.id);
    }
  }

  // Les annonces ciblent uniquement les membres actifs ayant conservé l'option Fleet News.
  async broadcastFleet(vehicleId: string, title: string, message: string): Promise<void> {
    await this.db.query(`INSERT INTO user_notifications
      (recipient_id,category,priority,title,message,action_url,event_key,entity_type,entity_id)
      SELECT u.id,'fleet','info',$2,$3,'/vehicles',$4,'vehicle',$1
      FROM users u LEFT JOIN notification_preferences p ON p.user_id=u.id
      WHERE u.status='active' AND p.fleet_news IS DISTINCT FROM false
      ON CONFLICT(recipient_id,event_key) DO NOTHING`,
      [vehicleId,title,message,`fleet:new:${vehicleId}`]);
  }

  // Confirmation d'une mise à jour de permis : aucun examen administratif nécessaire.
  async licenseUpdated(userId: string): Promise<void> {
    await this.insert(userId, 'security', 'success', 'Driving licence updated',
      'Your driving licence information has been saved.', '/account/profile',
      `licence:updated:${Date.now()}`, null);
  }

  async safelyLicenseUpdated(userId: string): Promise<void> {
    try { await this.licenseUpdated(userId); }
    catch (error) { this.logger.warn(`Licence notice unavailable: ${String(error)}`); }
  }

  // Rappel « permis manquant » : avertit un client connecté qui n'a pas
  // encore enregistré son permis de conduire. Appelé à chaque connexion :
  // l'avis n'est créé que si aucun profil client (permis) n'existe pour
  // cet utilisateur actif. La catégorie « security » n'est jamais filtrée
  // par les préférences de notification.
  async licenseRequired(userId: string): Promise<void> {
    const profiles = await this.db.query(
      `SELECT 1 FROM customer_profiles WHERE user_id=$1 LIMIT 1`, [userId]);
    if (profiles.length > 0) return;
    await this.insert(userId, 'security', 'warning', 'Driving licence required',
      'You must register your driving licence to be able to book a vehicle.',
      '/account/profile', `licence:required:${Date.now()}`, null);
  }

  async safelyLicenseRequired(userId: string): Promise<void> {
    try { await this.licenseRequired(userId); }
    catch (error) { this.logger.warn(`Licence reminder unavailable: ${String(error)}`); }
  }

  async safelyNotify(event: ReservationEvent, reservation: Reservation): Promise<void> {
    try { await this.reservationEvent(event, reservation); }
    catch (error) { this.logger.error('Notification failed after committed reservation', error); }
  }

  // Rappels 48h, 24h et 2h avant les événements. Le job peut tourner sur plusieurs instances.
  async scanReminders(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      // Une seule alerte par date d'expiration, même avec plusieurs serveurs.
      const expiringLicences: { user_id: string; license_expires_on: string }[] = await this.db.query(`
        SELECT user_id,license_expires_on FROM customer_profiles
        WHERE license_expires_on >= current_date
          AND license_expires_on <= current_date + interval '30 days'`);
      for (const profile of expiringLicences) {
        await this.insert(profile.user_id, 'security', 'warning', 'Driving licence expires soon',
          `Your driving licence expires on ${new Date(profile.license_expires_on).toISOString().slice(0, 10)}. Please update it before booking.`,
          '/account/profile', `licence:expiry:${new Date(profile.license_expires_on).toISOString().slice(0, 10)}`, null);
      }
      for (const [kind, column] of [['pickup', 'pickup_at'], ['return', 'return_at']] as const) {
        for (const hours of [48, 24, 2]) {
          const reservations: Reservation[] = await this.db.query(`SELECT * FROM reservations
            WHERE status IN ('confirmed','converted')
              AND ${column} BETWEEN now() + ($1::int * interval '1 hour') - interval '15 minutes'
                             AND now() + ($1::int * interval '1 hour')`, [hours]);
          for (const reservation of reservations) {
            const id = reservation.id;
            const number = (reservation as unknown as { reservation_number: string }).reservation_number;
            const customer = (reservation as unknown as { customer_id: string }).customer_id;
            const eventKey = `reminder:${id}:${kind}:${hours}h`;
            await this.insert(customer, 'rentals', hours === 2 ? 'warning' : 'info',
              `${kind === 'pickup' ? 'Pick-up' : 'Drop-off'} in ${hours} hours`,
              `Reminder for reservation ${number}. Check your booking for the confirmed location and time.`,
              '/account/reservations',eventKey,id);
          }
        }
      }
    } catch (error) { this.logger.warn(`Reminder scan unavailable: ${String(error)}`); }
    finally { this.running = false; }
  }

  onModuleInit(): void {
    void this.scanReminders();
    // Aucun package externe : intervalle 15 minutes, anti-doublons SQL.
    this.timer = setInterval(() => { void this.scanReminders(); }, 15 * 60_000);
    this.timer.unref?.();
  }
  onModuleDestroy(): void { if (this.timer) clearInterval(this.timer); }
}
