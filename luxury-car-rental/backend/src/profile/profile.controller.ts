
import {
    Body,
    Controller,
    Get,
    NotFoundException,
    Patch,
    Req,
    UseGuards,
} from '@nestjs/common';

import { UsersService } from '../users/users.service.js';

import type { User } from '../users/entities/user.entity.js';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

import type {
    AuthenticatedUser,
} from '../auth/guards/jwt-auth.guard.js';

import { UpdateProfileDto } from './dto/update-profile.dto.js';

@Controller('profile')
export class ProfileController {
    constructor(
        private readonly usersService: UsersService,
    ) { }

    // ==========================================
    // 1. GET MY PROFILE
    // ==========================================

    @Get('me')
    @UseGuards(JwtAuthGuard)
    async getMyProfile(
        @Req()
        request: { user: AuthenticatedUser },
    ) {
        const user = await this.usersService.findById(
            request.user.id,
        );

        if (!user) {
            throw new NotFoundException(
                'User not found',
            );
        }

        return this.toPublicProfile(user);
    }

    // ==========================================
    // 2. UPDATE MY PROFILE
    // ==========================================

    @Patch('me')
    @UseGuards(JwtAuthGuard)
    async updateMyProfile(
        @Req()
        request: { user: AuthenticatedUser },

        @Body()
        dto: UpdateProfileDto,
    ) {
        const user = await this.usersService.updateMyProfile(
            request.user.id,
            dto,
        );

        return this.toPublicProfile(user);
    }

    // ==========================================
    // 3. SAFE PROFILE RESPONSE
    // ==========================================

    private toPublicProfile(user: User) {
        return {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phone: user.phone,
            role: user.role,
            status: user.status,
            updatedAt: user.updatedAt,
        };
    }
}
