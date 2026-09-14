import { Body, Controller, Get, NotFoundException, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '@platform/auth/guards/jwt-auth.guard';
import { RbacService } from '@platform/rbac/rbac.service';
import { Tenant } from './entities/tenant.entity';
import { TenantsService } from './tenants.service';

interface CreateTenantBody {
  name: string;
}

@Controller('tenants')
@UseGuards(JwtAuthGuard)
export class TenantsController {
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly rbacService: RbacService,
  ) {}

  @Post()
  createTenant(@Body() body: CreateTenantBody, @Req() request: Request): Promise<Tenant> {
    const creatorUserId = (request.user as { userId: string }).userId;
    return this.tenantsService.createTenant(body.name, creatorUserId);
  }

  @Get(':id')
  async getTenant(@Param('id') id: string, @Req() request: Request): Promise<Tenant> {
    const userId = (request.user as { userId: string }).userId;

    // Same exception as a nonexistent tenant (TenantsService.getTenant
    // below), so a non-member can't use this endpoint to probe which
    // tenant IDs exist.
    if (!(await this.rbacService.isMember(userId, id))) {
      throw new NotFoundException('Tenant not found');
    }

    return this.tenantsService.getTenant(id);
  }
}
