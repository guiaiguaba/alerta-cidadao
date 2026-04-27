// apps/api/src/shared/decorators/current-tenant.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentTenant = createParamDecorator(
  (field: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    if (field) return request[field];
    return { tenantId: request.tenantId, schemaName: request.schemaName };
  },
);

// apps/api/src/shared/decorators/current-user.decorator.ts
export const CurrentUser = createParamDecorator(
  (field: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    if (field) return request.user?.[field];
    return request.user;
  },
);

// apps/api/src/shared/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';

export enum Role {
  CITIZEN   = 'citizen',
  AGENT     = 'agent',
  SUPERVISOR = 'supervisor',
  ADMIN     = 'admin',
  SUPER_ADMIN = 'super_admin',
}

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
