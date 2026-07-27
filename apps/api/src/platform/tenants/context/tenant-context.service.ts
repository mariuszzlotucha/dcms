import { Inject, Injectable, Scope, UnauthorizedException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

// Reads x-tenant-id for now. Once JWTs carry tenant memberships as a claim,
// this is the only place that needs to change.
@Injectable({ scope: Scope.REQUEST })
export class TenantContextService {
  constructor(@Inject(REQUEST) private readonly request: Request) {}

  getTenantId(): string {
    const tenantId = this.request.headers['x-tenant-id'];

    if (!tenantId || Array.isArray(tenantId)) {
      throw new UnauthorizedException('Missing tenant context');
    }

    return tenantId;
  }
}
