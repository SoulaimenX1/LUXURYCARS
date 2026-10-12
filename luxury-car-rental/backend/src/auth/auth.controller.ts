
import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Post,
    Req,
    UseGuards,
} from '@nestjs/common';

import {
    UserRole,
} from '../users/entities/user.entity.js';

import {
    AuthService,
} from './auth.service.js';

import {
    LoginDto,
} from './dto/login.dto.js';

import {
    RegisterDto,
} from './dto/register.dto.js';

import {
    Roles,
} from './decorators/roles.decorator.js';

import {
    JwtAuthGuard,
} from './guards/jwt-auth.guard.js';

import type {
    AuthenticatedUser,
} from './guards/jwt-auth.guard.js';

import {
    RolesGuard,
} from './guards/roles.guard.js';

@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
    ) { }

    // ==========================================
    // 1. PUBLIC: CUSTOMER REGISTRATION
    // ==========================================

    @Post('register')
    register(@Body() dto: RegisterDto) {
        return this.authService.register(dto);
    }

    // ==========================================
    // 2. PUBLIC: USER LOGIN
    // ==========================================

    @Post('login')
    @HttpCode(HttpStatus.OK)
    login(@Body() dto: LoginDto) {
        return this.authService.login(dto);
    }

    // ==========================================
    // 3. PRIVATE: AUTHENTICATED USER PROFILE
    // ==========================================

    @Get('me')
    @UseGuards(JwtAuthGuard)
    me(
        @Req()
        request: { user: AuthenticatedUser },
    ) {
        return request.user;
    }

    // ==========================================
    // 4. PRIVATE: ADMIN ACCESS CHECK
    // ==========================================

    @Get('admin-check')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    adminCheck() {
        return {
            message: 'Admin access granted',
        };
    }
}
