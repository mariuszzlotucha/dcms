import {
  ForbiddenException,
  Inject,
  Injectable,
  Scope,
  UnauthorizedException,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { RbacService } from '@platform/rbac/rbac.service';

// Reads x-tenant-id for now. Once JWTs carry tenant memberships as a claim,
// this is the only place that needs to change.
//
// The header is only ever a claim, never a grant: it names which tenant the
// caller wants, but RbacService.isMember() is what actually authorizes it
// against the JWT-authenticated user. Without that check, any authenticated
// user could read/act on any tenant just by setting the header.
@Injectable({ scope: Scope.REQUEST })
export class TenantContextService {
  constructor(
    @Inject(REQUEST) private readonly request: Request,
    private readonly rbacService: RbacService,
  ) {}

  async getTenantId(): Promise<string> {
    const tenantId = this.request.headers['x-tenant-id'];

    if (!tenantId || Array.isArray(tenantId)) {
      throw new UnauthorizedException('Missing tenant context');
    }

    const userId = (this.request.user as { userId?: string } | undefined)?.userId;

    if (!userId) {
      throw new UnauthorizedException('Missing tenant context');
    }

    if (!(await this.rbacService.isMember(userId, tenantId))) {
      throw new ForbiddenException('Not a member of this tenant');
    }

    return tenantId;
  }
}
