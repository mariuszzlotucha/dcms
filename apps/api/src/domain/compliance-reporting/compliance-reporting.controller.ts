import { Body, Controller, Get, Param, Post, Req, UseGuards, UsePipes } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '@platform/auth/guards/jwt-auth.guard';
import { Roles } from '@platform/rbac/decorators/roles.decorator';
import { RolesGuard } from '@platform/rbac/guards/roles.guard';
import { ZodValidationPipe } from '@platform/security/pipes/zod-validation.pipe';
import { TenantContextService } from '@platform/tenants/context/tenant-context.service';
import {
  ExportComplianceReportDto,
  exportComplianceReportSchema,
  GenerateComplianceReportDto,
  generateComplianceReportSchema,
} from '@contracts/compliance-reporting.schema';
import { ComplianceReport } from './entities/compliance-report.entity';
import { ComplianceReportExport, ComplianceReportingService } from './compliance-reporting.service';

@Controller('compliance/reports')
@UseGuards(JwtAuthGuard)
export class ComplianceReportingController {
  constructor(
    private readonly complianceReportingService: ComplianceReportingService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Post()
  @Roles('owner', 'admin')
  @UseGuards(RolesGuard)
  @UsePipes(new ZodValidationPipe(generateComplianceReportSchema))
  async generateReport(@Body() dto: GenerateComplianceReportDto, @Req() request: Request): Promise<ComplianceReport> {
    const tenantId = await this.tenantContext.getTenantId();
    const userId = (request.user as { userId: string }).userId;
    return this.complianceReportingService.generateReport(tenantId, dto.contractId ?? null, userId);
  }

  @Get()
  async listReports(): Promise<ComplianceReport[]> {
    const tenantId = await this.tenantContext.getTenantId();
    return this.complianceReportingService.listReports(tenantId);
  }

  @Get(':id')
  async getReport(@Param('id') id: string): Promise<ComplianceReport> {
    const tenantId = await this.tenantContext.getTenantId();
    return this.complianceReportingService.getReport(tenantId, id);
  }

  @Post(':id/export')
  @Roles('owner', 'admin')
  @UseGuards(RolesGuard)
  @UsePipes(new ZodValidationPipe(exportComplianceReportSchema))
  async exportReport(@Param('id') id: string, @Body() dto: ExportComplianceReportDto): Promise<ComplianceReportExport> {
    const tenantId = await this.tenantContext.getTenantId();
    return this.complianceReportingService.exportReport(tenantId, id, dto.format);
  }
}
