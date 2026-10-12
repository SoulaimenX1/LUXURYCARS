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
import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '../users/entities/user.entity.js';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { Roles } from './decorators/roles.decorator.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { RolesGuard } from './guards/roles.guard.js';
export class AuthController {
    // ==========================================
    // 1. PUBLIC: CUSTOMER REGISTRATION
    // ==========================================
    register(dto) {
        return this.authService.register(dto);
    }
    // ==========================================
    // 2. PUBLIC: USER LOGIN
    // ==========================================
    login(dto) {
        return this.authService.login(dto);
    }
    // ==========================================
    // 3. PRIVATE: AUTHENTICATED USER PROFILE
    // ==========================================
    me(request) {
        return request.user;
    }
    // ==========================================
    // 4. PRIVATE: ADMIN ACCESS CHECK
    // ==========================================
    adminCheck() {
        return {
            message: 'Admin access granted'
        };
    }
    constructor(authService){
        this.authService = authService;
    }
}
_ts_decorate([
    Post('register'),
    _ts_param(0, Body()),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof RegisterDto === "undefined" ? Object : RegisterDto
    ]),
    _ts_metadata("design:returntype", void 0)
], AuthController.prototype, "register", null);
_ts_decorate([
    Post('login'),
    HttpCode(HttpStatus.OK),
    _ts_param(0, Body()),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof LoginDto === "undefined" ? Object : LoginDto
    ]),
    _ts_metadata("design:returntype", void 0)
], AuthController.prototype, "login", null);
_ts_decorate([
    Get('me'),
    UseGuards(JwtAuthGuard),
    _ts_param(0, Req()),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        Object
    ]),
    _ts_metadata("design:returntype", void 0)
], AuthController.prototype, "me", null);
_ts_decorate([
    Get('admin-check'),
    UseGuards(JwtAuthGuard, RolesGuard),
    Roles(UserRole.ADMIN),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", []),
    _ts_metadata("design:returntype", void 0)
], AuthController.prototype, "adminCheck", null);
AuthController = _ts_decorate([
    Controller('auth'),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof AuthService === "undefined" ? Object : AuthService
    ])
], AuthController);

//# sourceMappingURL=auth.controller.js.map