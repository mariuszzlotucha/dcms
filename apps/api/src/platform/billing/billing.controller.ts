import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@platform/auth/guards/jwt-auth.guard';
import { Roles } from '@platform/rbac/decorators/roles.decorator';
import { RolesGuard } from '@platform/rbac/guards/roles.guard';
import { TenantContextService } from '@platform/tenants/context/tenant-context.service';
import { BillingService } from './billing.service';

interface CreateCheckoutSessionBody {
  planKey: string;
}

interface ChangePlanBody {
  planKey: string;
}

@Controller('billing')
@UseGuards(JwtAuthGuard)
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Post('checkout-session')
  @Roles('owner', 'admin')
  @UseGuards(RolesGuard)
  async createCheckoutSession(@Body() body: CreateCheckoutSessionBody): Promise<{ url: string }> {
    const tenantId = await this.tenantContext.getTenantId();
    const url = await this.billingService.createCheckoutSession(tenantId, body.planKey);
    return { url };
  }

  @Get('subscription')
  async getSubscription() {
    return this.billingService.getSubscription(await this.tenantContext.getTenantId());
  }

  @Post('change-plan')
  @Roles('owner', 'admin')
  @UseGuards(RolesGuard)
  async changePlan(@Body() body: ChangePlanBody) {
    return this.billingService.changePlan(await this.tenantContext.getTenantId(), body.planKey);
  }
}
