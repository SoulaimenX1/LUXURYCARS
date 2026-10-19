import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { UsersModule } from '../users/users.module.js';
import { User } from '../users/entities/user.entity.js';
import { CustomerProfile } from '../customer-profiles/entities/customer-profile.entity.js';
import { Reservation } from '../reservations/entities/reservation.entity.js';
import { AdminCustomersController } from './admin-customers.controller.js';
import { AdminCustomersService } from './admin-customers.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([User, CustomerProfile, Reservation]), AuthModule, UsersModule],
  providers: [AdminCustomersService],
  controllers: [AdminCustomersController],
})
export class AdminCustomersModule {}
