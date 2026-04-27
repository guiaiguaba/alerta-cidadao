// apps/api/src/shared/guards/roles.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, Role } from '../decorators/index';

// Hierarquia de roles: super_admin > admin > supervisor > agent > citizen
const ROLE_HIERARCHY: Record<Role, number> = {
  [Role.CITIZEN]:    1,
  [Role.AGENT]:      2,
  [Role.SUPERVISOR]: 3,
  [Role.ADMIN]:      4,
  [Role.SUPER_ADMIN]:5,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) throw new ForbiddenException('Acesso negado');

    const userLevel = ROLE_HIERARCHY[user.role as Role] ?? 0;
    const minRequired = Math.min(
      ...requiredRoles.map(r => ROLE_HIERARCHY[r] ?? 99),
    );

    if (userLevel < minRequired) {
      throw new ForbiddenException(
        `Permissão insuficiente. Requerido: ${requiredRoles.join(' ou ')}`,
      );
    }

    return true;
  }
}
