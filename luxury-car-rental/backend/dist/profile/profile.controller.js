function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") {
        r = Reflect.decorate(decorators, target, key, desc);
    } else {
        for(var i = decorators.length - 1; i >= 0; i--){
            if (d = decorators[i]) {
                r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
            }
        }
    }
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(metadataKey, metadataValue) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") {
        return Reflect.metadata(metadataKey, metadataValue);
    }
}
function _ts_param(paramIndex, decorator) {
    return function(target, key) {
        decorator(target, key, paramIndex);
    };
}
import { Body, Controller, Get, NotFoundException, Patch, Req, UseGuards } from '@nestjs/common';
import { UsersService } from '../users/users.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
export class ProfileController {
    // ==========================================
    // 1. GET MY PROFILE
    // ==========================================
    async getMyProfile(request) {
        const user = await this.usersService.findById(request.user.id);
        if (!user) {
            throw new NotFoundException('User not found');
        }
        return this.toPublicProfile(user);
    }
    // ==========================================
    // 2. UPDATE MY PROFILE
    // ==========================================
    async updateMyProfile(request, dto) {
        const user = await this.usersService.updateMyProfile(request.user.id, dto);
        return this.toPublicProfile(user);
    }
    // ==========================================
    // 3. SAFE PROFILE RESPONSE
    // ==========================================
    toPublicProfile(user) {
        return {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phone: user.phone,
            role: user.role,
            status: user.status,
            updatedAt: user.updatedAt
        };
    }
    constructor(usersService){
        this.usersService = usersService;
    }
}
_ts_decorate([
    Get('me'),
    UseGuards(JwtAuthGuard),
    _ts_param(0, Req()),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        Object
    ]),
    _ts_metadata("design:returntype", Promise)
], ProfileController.prototype, "getMyProfile", null);
_ts_decorate([
    Patch('me'),
    UseGuards(JwtAuthGuard),
    _ts_param(0, Req()),
    _ts_param(1, Body()),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        Object,
        typeof UpdateProfileDto === "undefined" ? Object : UpdateProfileDto
    ]),
    _ts_metadata("design:returntype", Promise)
], ProfileController.prototype, "updateMyProfile", null);
ProfileController = _ts_decorate([
    Controller('profile'),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof UsersService === "undefined" ? Object : UsersService
    ])
], ProfileController);

//# sourceMappingURL=profile.controller.js.map