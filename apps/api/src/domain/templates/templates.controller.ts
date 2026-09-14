import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards, UsePipes } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '@platform/auth/guards/jwt-auth.guard';
import { Roles } from '@platform/rbac/decorators/roles.decorator';
import { RolesGuard } from '@platform/rbac/guards/roles.guard';
import { ZodValidationPipe } from '@platform/security/pipes/zod-validation.pipe';
import { TenantContextService } from '@platform/tenants/context/tenant-context.service';
import {
  AddTemplateClauseDto,
  addTemplateClauseSchema,
  CreateTemplateDto,
  createTemplateSchema,
  TemplateCategory,
  TemplateStatus,
  UpdateTemplateClauseDto,
  updateTemplateClauseSchema,
  UpdateTemplateDto,
  updateTemplateSchema,
} from '@contracts/template.schema';
import { TemplateClause } from './entities/template-clause.entity';
import { Template } from './entities/template.entity';
import { TemplatesService } from './templates.service';

@Controller('templates')
@UseGuards(JwtAuthGuard)
export class TemplatesController {
  constructor(
    private readonly templatesService: TemplatesService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Post()
  @Roles('owner', 'admin')
  @UseGuards(RolesGuard)
  @UsePipes(new ZodValidationPipe(createTemplateSchema))
  async createTemplate(@Body() dto: CreateTemplateDto, @Req() request: Request): Promise<Template> {
    const tenantId = await this.tenantContext.getTenantId();
    const userId = (request.user as { userId: string }).userId;
    return this.templatesService.createTemplate(tenantId, userId, dto);
  }

  @Get()
  async listTemplates(
    @Query('category') category?: TemplateCategory,
    @Query('status') status?: TemplateStatus,
  ): Promise<Template[]> {
    const tenantId = await this.tenantContext.getTenantId();
    return this.templatesService.listTemplates(tenantId, { category, status });
  }

  @Get(':id')
  async getTemplate(@Param('id') id: string): Promise<Template> {
    const tenantId = await this.tenantContext.getTenantId();
    return this.templatesService.getTemplate(tenantId, id);
  }

  @Patch(':id')
  @Roles('owner', 'admin')
  @UseGuards(RolesGuard)
  @UsePipes(new ZodValidationPipe(updateTemplateSchema))
  async updateTemplate(
    @Param('id') id: string,
    @Body() dto: UpdateTemplateDto,
    @Req() request: Request,
  ): Promise<Template> {
    const tenantId = await this.tenantContext.getTenantId();
    const userId = (request.user as { userId: string }).userId;
    return this.templatesService.updateTemplate(tenantId, id, userId, dto);
  }

  @Post(':id/publish')
  @Roles('owner', 'admin')
  @UseGuards(RolesGuard)
  async publishTemplate(@Param('id') id: string): Promise<Template> {
    const tenantId = await this.tenantContext.getTenantId();
    return this.templatesService.publishTemplate(tenantId, id);
  }

  @Get(':id/clauses')
  async listClauses(@Param('id') id: string): Promise<TemplateClause[]> {
    const tenantId = await this.tenantContext.getTenantId();
    return this.templatesService.listClauses(tenantId, id);
  }

  @Post(':id/clauses')
  @Roles('owner', 'admin')
  @UseGuards(RolesGuard)
  @UsePipes(new ZodValidationPipe(addTemplateClauseSchema))
  async addClause(@Param('id') id: string, @Body() dto: AddTemplateClauseDto): Promise<TemplateClause> {
    const tenantId = await this.tenantContext.getTenantId();
    return this.templatesService.addClause(tenantId, id, dto);
  }

  @Patch(':id/clauses/:clauseId')
  @Roles('owner', 'admin')
  @UseGuards(RolesGuard)
  @UsePipes(new ZodValidationPipe(updateTemplateClauseSchema))
  async updateClause(
    @Param('id') id: string,
    @Param('clauseId') clauseId: string,
    @Body() dto: UpdateTemplateClauseDto,
  ): Promise<TemplateClause> {
    const tenantId = await this.tenantContext.getTenantId();
    return this.templatesService.updateClause(tenantId, id, clauseId, dto);
  }

  @Delete(':id/clauses/:clauseId')
  @Roles('owner', 'admin')
  @UseGuards(RolesGuard)
  async removeClause(@Param('id') id: string, @Param('clauseId') clauseId: string): Promise<void> {
    const tenantId = await this.tenantContext.getTenantId();
    return this.templatesService.removeClause(tenantId, id, clauseId);
  }
}
