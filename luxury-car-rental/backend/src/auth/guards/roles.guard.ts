
import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';

import { Reflector } from '@nestjs/core';

import {
    UserRole,
} from '../../users/entities/user.entity.js';

import {
    ROLES_KEY,
} from '../decorators/roles.decorator.js';

import type {
    AuthenticatedUser,
} from './jwt-auth.guard.js';

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
    ) { }

    canActivate(
        context: ExecutionContext,
    ): boolean {
        const requiredRoles =
            this.reflector.getAllAndOverride<UserRole[]>(
                ROLES_KEY,
                [
                    context.getHandler(),
                    context.getClass(),
                ],
            );

        // No specific role is required
        if (!requiredRoles?.length) {
            return true;
        }

        const request = context
            .switchToHttp()
            .getRequest<{
                user?: AuthenticatedUser;
            }>();

        const user = request.user;

        if (!user) {
            throw new UnauthorizedException(
                'Authentication required',
            );
        }

        if (!requiredRoles.includes(user.role)) {
            throw new ForbiddenException(
                'Insufficient permissions',
            );
        }

        return true;
    }
}
