import { Body, Controller, Delete, Get, Param, Post, UseGuards, UsePipes } from '@nestjs/common';
import { JwtAuthGuard } from '@platform/auth/guards/jwt-auth.guard';
import { Roles } from '@platform/rbac/decorators/roles.decorator';
import { RolesGuard } from '@platform/rbac/guards/roles.guard';
import { ZodValidationPipe } from '@platform/security/pipes/zod-validation.pipe';
import { TenantContextService } from '@platform/tenants/context/tenant-context.service';
import {
  ConnectIntegrationDto,
  connectIntegrationSchema,
  IntegrationType,
} from '@contracts/integrations.schema';
import { IntegrationConnection } from './entities/integration-connection.entity';
import { IntegrationsService } from './integrations.service';

@Controller('integrations')
@UseGuards(JwtAuthGuard)
export class IntegrationsController {
  constructor(
    private readonly integrationsService: IntegrationsService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Get()
  async listConnections(): Promise<IntegrationConnection[]> {
    const tenantId = await this.tenantContext.getTenantId();
    return this.integrationsService.listConnections(tenantId);
  }

  @Post(':integration/connect')
  @Roles('owner', 'admin')
  @UseGuards(RolesGuard)
  @UsePipes(new ZodValidationPipe(connectIntegrationSchema))
  async connect(
    @Param('integration') integration: IntegrationType,
    @Body() dto: ConnectIntegrationDto,
  ): Promise<IntegrationConnection> {
    const tenantId = await this.tenantContext.getTenantId();
    return this.integrationsService.connect(tenantId, integration, dto.syncUrl);
  }

  @Delete(':integration')
  @Roles('owner', 'admin')
  @UseGuards(RolesGuard)
  async disconnect(@Param('integration') integration: IntegrationType): Promise<void> {
    const tenantId = await this.tenantContext.getTenantId();
    return this.integrationsService.disconnect(tenantId, integration);
  }
}
