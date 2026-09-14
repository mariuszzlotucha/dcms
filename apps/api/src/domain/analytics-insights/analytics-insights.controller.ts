import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '@platform/auth/guards/jwt-auth.guard';
import { TenantContextService } from '@platform/tenants/context/tenant-context.service';
import { AnalyticsInsightsService } from './analytics-insights.service';
import { AnalyticsReport } from './entities/analytics-report.entity';
import { TenantMetric } from './entities/tenant-metric.entity';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsInsightsController {
  constructor(
    private readonly analyticsInsightsService: AnalyticsInsightsService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Get('dashboard')
  async getDashboard(): Promise<TenantMetric[]> {
    const tenantId = await this.tenantContext.getTenantId();
    return this.analyticsInsightsService.getDashboard(tenantId);
  }

  @Post('reports')
  async generateReport(@Req() request: Request): Promise<AnalyticsReport> {
    const tenantId = await this.tenantContext.getTenantId();
    const userId = (request.user as { userId: string }).userId;
    return this.analyticsInsightsService.generateReport(tenantId, userId);
  }

  @Get('reports')
  async listReports(): Promise<AnalyticsReport[]> {
    const tenantId = await this.tenantContext.getTenantId();
    return this.analyticsInsightsService.listReports(tenantId);
  }
}
