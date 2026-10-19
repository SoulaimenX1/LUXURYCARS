import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccountStatus, User, UserRole } from '../users/entities/user.entity.js';
import { CustomerProfile } from '../customer-profiles/entities/customer-profile.entity.js';
import { Reservation } from '../reservations/entities/reservation.entity.js';

// Résultat renvoyé par une bascule de statut de compte.
export interface AccountStatusChange {
  id: string;
  status: AccountStatus;
  changed: boolean;
}

@Injectable()
export class AdminCustomersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(CustomerProfile) private readonly profiles: Repository<CustomerProfile>,
    @InjectRepository(Reservation) private readonly reservations: Repository<Reservation>,
  ) {}

  // Les informations de permis sont accessibles uniquement à l'admin.
  async findAll() {
    const users = await this.users.find({
      where: { role: UserRole.CUSTOMER },
      order: { createdAt: 'DESC' },
    });
    const profiles = await this.profiles.find();
    const reservations = await this.reservations.find({ order: { createdAt: 'DESC' } });
    const byUser = new Map(profiles.map((profile) => [profile.userId, profile]));
    return users.map(({ id, firstName, lastName, email, phone, status, createdAt }) => ({
      id, firstName, lastName, email, phone, status, createdAt,
      profile: byUser.get(id) ?? null,
      reservations: reservations.filter((reservation) => reservation.customerId === id),
    }));
  }

  async findById(id: string) {
    const customers = await this.findAll();
    const customer = customers.find((item) => item.id === id);
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  // ==========================================
  // GESTION DU STATUT DU COMPTE CLIENT
  // ==========================================

  // Suspendre un compte client : le client ne peut plus se connecter
  // ni effectuer la moindre action authentifiée (le JwtAuthGuard
  // refuse tout jeton dont le compte n'est plus actif). Aucune
  // réservation ni donnée financière existante n'est modifiée.
  async suspendCustomer(id: string, adminId: string): Promise<AccountStatusChange> {
    return this.changeAccountStatus(id, adminId, AccountStatus.SUSPENDED);
  }

  // Réactiver un compte précédemment suspendu. Opération idempotente.
  async reactivateCustomer(id: string, adminId: string): Promise<AccountStatusChange> {
    return this.changeAccountStatus(id, adminId, AccountStatus.ACTIVE);
  }

  private async changeAccountStatus(
    id: string,
    adminId: string,
    status: AccountStatus,
  ): Promise<AccountStatusChange> {
    // Un administrateur ne peut pas suspendre/désactiver son propre
    // compte par erreur depuis la gestion clientèle.
    if (id === adminId) {
      throw new BadRequestException(
        'Administrators cannot change the status of their own account',
      );
    }

    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Customer not found');

    // Seuls les comptes clients sont concernés : jamais un staff
    // ni un autre administrateur.
    if (user.role !== UserRole.CUSTOMER) {
      throw new BadRequestException(
        'Only customer accounts can be suspended or reactivated',
      );
    }

    // Idempotence : déjà dans l'état demandé, on renvoie l'existant
    // sans écriture ni erreur.
    if (user.status === status) {
      return { id: user.id, status: user.status, changed: false };
    }

    user.status = status;
    await this.users.save(user);
    return { id: user.id, status: user.status, changed: true };
  }
}
