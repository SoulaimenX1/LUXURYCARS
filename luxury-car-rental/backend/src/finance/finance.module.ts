import {Module} from '@nestjs/common';
import {AuthModule} from '../auth/auth.module.js';
import {UsersModule} from '../users/users.module.js';
import {FinanceService} from './finance.service.js';
import {FinanceAdminController,FinanceCustomerController} from './finance.controller.js';
@Module({imports:[AuthModule,UsersModule],providers:[FinanceService],controllers:[FinanceAdminController,FinanceCustomerController]})
export class FinanceModule{}
