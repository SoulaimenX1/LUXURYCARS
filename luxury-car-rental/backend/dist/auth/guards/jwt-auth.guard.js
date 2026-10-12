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
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../../users/users.service.js';
import { AccountStatus } from '../../users/entities/user.entity.js';
export class JwtAuthGuard {
    async canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const authorization = request.headers.authorization;
        if (!authorization) {
            throw new UnauthorizedException('Authentication required');
        }
        const [type, token] = authorization.split(' ');
        if (type !== 'Bearer' || !token) {
            throw new UnauthorizedException('Invalid authorization header');
        }
        let payload;
        try {
            payload = await this.jwtService.verifyAsync(token);
        } catch  {
            throw new UnauthorizedException('Invalid or expired token');
        }
        if (!payload || typeof payload.sub !== 'string') {
            throw new UnauthorizedException('Invalid token payload');
        }
        const user = await this.usersService.findById(payload.sub);
        if (!user || user.status !== AccountStatus.ACTIVE) {
            throw new UnauthorizedException('Account unavailable');
        }
        request.user = {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            role: user.role
        };
        return true;
    }
    constructor(jwtService, usersService){
        this.jwtService = jwtService;
        this.usersService = usersService;
    }
}
JwtAuthGuard = _ts_decorate([
    Injectable(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof JwtService === "undefined" ? Object : JwtService,
        typeof UsersService === "undefined" ? Object : UsersService
    ])
], JwtAuthGuard);

//# sourceMappingURL=jwt-auth.guard.js.map