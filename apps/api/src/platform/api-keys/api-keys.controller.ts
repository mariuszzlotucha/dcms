import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@platform/auth/guards/jwt-auth.guard';
import { Roles } from '@platform/rbac/decorators/roles.decorator';
import { RolesGuard } from '@platform/rbac/guards/roles.guard';
import { TenantContextService } from '@platform/tenants/context/tenant-context.service';
import { ApiKeysService } from './api-keys.service';

interface CreateApiKeyBody {
  label: string;
  scopes: string[];
}

@Controller('api-keys')
@UseGuards(JwtAuthGuard)
export class ApiKeysController {
  constructor(
    private readonly apiKeysService: ApiKeysService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Post()
  @Roles('owner', 'admin')
  @UseGuards(RolesGuard)
  createKey(@Body() body: CreateApiKeyBody) {
    return this.apiKeysService.createKey(this.tenantContext.getTenantId(), body.label, body.scopes);
  }

  @Get()
  listKeys() {
    return this.apiKeysService.listKeys(this.tenantContext.getTenantId());
  }

  @Delete(':id')
  @Roles('owner', 'admin')
  @UseGuards(RolesGuard)
  revokeKey(@Param('id') id: string) {
    return this.apiKeysService.revokeKey(this.tenantContext.getTenantId(), id);
  }
}
