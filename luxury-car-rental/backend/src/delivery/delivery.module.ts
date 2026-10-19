import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { UsersModule } from '../users/users.module.js';
import { PremiumModule } from '../premium/premium.module.js';
import { DeliveryService } from './delivery.service.js';
import { DeliveryController } from './delivery.controller.js';

// Devis de livraison persistés (extension du devis serveur premium).
@Module({
  imports: [AuthModule, UsersModule, PremiumModule],
  providers: [DeliveryService],
  controllers: [DeliveryController],
  exports: [DeliveryService],
})
export class DeliveryModule {}
