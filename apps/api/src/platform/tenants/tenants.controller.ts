import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '@platform/auth/guards/jwt-auth.guard';
import { Tenant } from './entities/tenant.entity';
import { TenantsService } from './tenants.service';

interface CreateTenantBody {
  name: string;
}

@Controller('tenants')
@UseGuards(JwtAuthGuard)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  createTenant(@Body() body: CreateTenantBody, @Req() request: Request): Promise<Tenant> {
    const creatorUserId = (request.user as { userId: string }).userId;
    return this.tenantsService.createTenant(body.name, creatorUserId);
  }

  @Get(':id')
  getTenant(@Param('id') id: string): Promise<Tenant> {
    return this.tenantsService.getTenant(id);
  }
}
