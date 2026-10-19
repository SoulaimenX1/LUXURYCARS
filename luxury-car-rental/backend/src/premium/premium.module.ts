import {Module} from '@nestjs/common';
import {AuthModule} from '../auth/auth.module.js';
import {UsersModule} from '../users/users.module.js';
import {PremiumService} from './premium.service.js';
import {PremiumController} from './premium.controller.js';
import {PremiumAdminController} from './premium-admin.controller.js';
@Module({imports:[AuthModule,UsersModule],providers:[PremiumService],controllers:[PremiumController,PremiumAdminController],exports:[PremiumService]})
export class PremiumModule{}
