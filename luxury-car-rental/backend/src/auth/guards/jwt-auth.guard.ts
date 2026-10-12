
import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';

import { UsersService } from '../../users/users.service.js';

import {
    AccountStatus,
    User,
} from '../../users/entities/user.entity.js';

export type AuthenticatedUser = Pick<
    User,
    'id' | 'firstName' | 'lastName' | 'email' | 'role'
>;

@Injectable()
export class JwtAuthGuard implements CanActivate {
    constructor(
        private readonly jwtService: JwtService,
        private readonly usersService: UsersService,
    ) { }

    async canActivate(
        context: ExecutionContext,
    ): Promise<boolean> {
        const request = context.switchToHttp().getRequest<{
            headers: { authorization?: string };
            user?: AuthenticatedUser;
        }>();

        const authorization =
            request.headers.authorization;

        if (!authorization) {
            throw new UnauthorizedException(
                'Authentication required',
            );
        }

        const [type, token] =
            authorization.split(' ');

        if (type !== 'Bearer' || !token) {
            throw new UnauthorizedException(
                'Invalid authorization header',
            );
        }

        let payload: { sub: string };

        try {
            payload =
                await this.jwtService.verifyAsync<{
                    sub: string;
                }>(token);
        } catch {
            throw new UnauthorizedException(
                'Invalid or expired token',
            );
        }

        if (
            !payload ||
            typeof payload.sub !== 'string'
        ) {
            throw new UnauthorizedException(
                'Invalid token payload',
            );
        }

        const user =
            await this.usersService.findById(
                payload.sub,
            );

        if (
            !user ||
            user.status !== AccountStatus.ACTIVE
        ) {
            throw new UnauthorizedException(
                'Account unavailable',
            );
        }

        request.user = {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            role: user.role,
        };

        return true;
    }
}
