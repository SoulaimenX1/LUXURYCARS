import {Module} from '@nestjs/common';
import {AuthModule} from '../auth/auth.module.js';
import {UsersModule} from '../users/users.module.js';
import {ReturnsService} from './returns.service.js';
import {ReturnsController} from './returns.controller.js';
@Module({imports:[AuthModule,UsersModule],providers:[ReturnsService],controllers:[ReturnsController]})
export class ReturnsModule{}
