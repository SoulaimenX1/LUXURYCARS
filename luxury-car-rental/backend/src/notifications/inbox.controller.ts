import { Body, Controller, Get, NotFoundException, Param, Patch, Query, Req, Sse, UseGuards, BadRequestException } from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { InboxService } from './inbox.service.js';

interface AuthRequest { user: { id: string }; }
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Toutes les requêtes sont limitées à l'identifiant JWT ; aucune sélection libre de recipientId.
@Controller('notifications/inbox')
@UseGuards(JwtAuthGuard)
export class InboxController {
  constructor(private readonly inbox: InboxService) {}

  // ==========================================================
  // FLUX TEMPS RÉEL (SERVER-SENT EVENTS)
  // ==========================================================
  //
  // Pousse, sans rechargement, les notifications réellement créées
  // pour l'utilisateur du JWT. La diffusion est strictement filtrée
  // par destinataire côté service : impossible d'écouter les avis
  // d'un autre compte. Le flux est authentifié par le même JwtAuthGuard
  // que le reste du centre de notifications.
  @Sse('stream')
  stream(@Req() req: AuthRequest): Observable<MessageEvent> {
    const userId = req.user.id;
    return new Observable<MessageEvent>((subscriber) => {
      // Signal d'établissement : le client sait que le canal est prêt.
      subscriber.next({ data: { type: 'connected' } });
      const unsubscribe = this.inbox.subscribe(userId, (item) => {
        subscriber.next({ data: { type: 'notification', item } });
      });
      // Battement de cœur : maintient la connexion à travers les
      // proxys et détecte les connexions mortes.
      const heartbeat = setInterval(() => {
        subscriber.next({ data: { type: 'ping' } });
      }, 25000);
      heartbeat.unref?.();
      return () => {
        clearInterval(heartbeat);
        unsubscribe();
      };
    });
  }

  @Get()
  list(@Req() req: AuthRequest, @Query('category') category = 'all',
    @Query('unread') unread = 'false', @Query('page') page = '0') {
    const pageIndex = Number(page);
    if (!Number.isInteger(pageIndex) || pageIndex < 0 || pageIndex > 100) {
      throw new BadRequestException('Invalid page');
    }
    return this.inbox.list(req.user.id, category, unread === 'true', pageIndex * 30);
  }

  @Get('unread-count')
  async unreadCount(@Req() req: AuthRequest) { return { count: await this.inbox.unreadCount(req.user.id) }; }

  @Get('preferences')
  preferences(@Req() req: AuthRequest) { return this.inbox.preferences(req.user.id); }

  @Patch('preferences')
  async updatePreferences(@Req() req: AuthRequest, @Body() input: unknown) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new BadRequestException('Invalid preferences');
    const data = input as Record<string, unknown>;
    const keys = ['bookingUpdates','rentalReminders','fleetNews','emailEnabled'];
    if (Object.keys(data).some((key) => !keys.includes(key)) || keys.some((key) => typeof data[key] !== 'boolean')) {
      throw new BadRequestException('Invalid preference values');
    }
    if (data.emailEnabled === true) throw new BadRequestException('Email delivery is not configured');
    return this.inbox.updatePreferences(req.user.id, data as {
      bookingUpdates: boolean; rentalReminders: boolean; fleetNews: boolean; emailEnabled: boolean;
    });
  }

  @Patch('read-all')
  async readAll(@Req() req: AuthRequest) { await this.inbox.readAll(req.user.id); return { success: true }; }

  @Patch(':id/read')
  async markRead(@Req() req: AuthRequest, @Param('id') id: string) {
    if (!uuidPattern.test(id)) throw new BadRequestException('Invalid notification ID');
    if (!await this.inbox.markRead(req.user.id,id)) throw new NotFoundException('Notification not found');
    return { success: true };
  }

  @Patch(':id/archive')
  async archive(@Req() req: AuthRequest, @Param('id') id: string) {
    if (!uuidPattern.test(id)) throw new BadRequestException('Invalid notification ID');
    if (!await this.inbox.archive(req.user.id,id)) throw new NotFoundException('Notification not found');
    return { success: true };
  }
}
