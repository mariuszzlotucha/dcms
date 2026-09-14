import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RbacRole } from '../rbac.config';
import { RbacService } from '../rbac.service';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rbacService: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<RbacRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userId = request.user?.userId;

    if (!userId) {
      throw new UnauthorizedException();
    }

    // Resolved independently of TenantContextService: that service is only
    // invoked from inside handler bodies, which run after this guard, so it
    // can't supply the tenant here. RbacService.isMember() stays the single
    // authoritative membership check either way.
    const tenantId = request.headers['x-tenant-id'];

    if (!tenantId || Array.isArray(tenantId)) {
      throw new UnauthorizedException('Missing tenant context');
    }

    if (!(await this.rbacService.isMember(userId, tenantId))) {
      throw new ForbiddenException('Not a member of this tenant');
    }

    const checks = await Promise.all(
      requiredRoles.map((role) => this.rbacService.hasRole(userId, tenantId, role)),
    );

    return checks.some(Boolean);
  }
}
