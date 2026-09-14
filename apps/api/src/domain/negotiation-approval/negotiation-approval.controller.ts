import { Body, Controller, Get, Param, Post, Req, UseGuards, UsePipes } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '@platform/auth/guards/jwt-auth.guard';
import { Roles } from '@platform/rbac/decorators/roles.decorator';
import { RolesGuard } from '@platform/rbac/guards/roles.guard';
import { ZodValidationPipe } from '@platform/security/pipes/zod-validation.pipe';
import { TenantContextService } from '@platform/tenants/context/tenant-context.service';
import {
  AssignNegotiationRoleDto,
  assignNegotiationRoleSchema,
  RejectApprovalDto,
  rejectApprovalSchema,
  RequestRevisionDto,
  requestRevisionSchema,
} from '@contracts/negotiation-approval.schema';
import { ApprovalRequest } from './entities/approval-request.entity';
import { NegotiationRoleAssignment } from './entities/negotiation-role-assignment.entity';
import { NegotiationApprovalService } from './negotiation-approval.service';

@Controller('contracts/:contractId/negotiation')
@UseGuards(JwtAuthGuard)
export class NegotiationApprovalController {
  constructor(
    private readonly negotiationApprovalService: NegotiationApprovalService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Post('roles')
  @Roles('owner', 'admin')
  @UseGuards(RolesGuard)
  @UsePipes(new ZodValidationPipe(assignNegotiationRoleSchema))
  async assignRole(
    @Param('contractId') contractId: string,
    @Body() dto: AssignNegotiationRoleDto,
  ): Promise<NegotiationRoleAssignment> {
    const tenantId = await this.tenantContext.getTenantId();
    return this.negotiationApprovalService.assignRole(tenantId, contractId, dto.userId, dto.role);
  }

  @Get('roles')
  async listRoles(@Param('contractId') contractId: string): Promise<NegotiationRoleAssignment[]> {
    const tenantId = await this.tenantContext.getTenantId();
    return this.negotiationApprovalService.listRoles(tenantId, contractId);
  }

  @Get('approval-requests')
  async listApprovalRequests(@Param('contractId') contractId: string): Promise<ApprovalRequest[]> {
    const tenantId = await this.tenantContext.getTenantId();
    return this.negotiationApprovalService.listApprovalRequests(tenantId, contractId);
  }

  @Post('approve')
  async grantApproval(@Param('contractId') contractId: string, @Req() request: Request): Promise<ApprovalRequest> {
    const tenantId = await this.tenantContext.getTenantId();
    const userId = (request.user as { userId: string }).userId;
    return this.negotiationApprovalService.grantApproval(tenantId, contractId, userId);
  }

  @Post('reject')
  @UsePipes(new ZodValidationPipe(rejectApprovalSchema))
  async rejectApproval(
    @Param('contractId') contractId: string,
    @Body() dto: RejectApprovalDto,
    @Req() request: Request,
  ): Promise<ApprovalRequest> {
    const tenantId = await this.tenantContext.getTenantId();
    const userId = (request.user as { userId: string }).userId;
    return this.negotiationApprovalService.rejectApproval(tenantId, contractId, userId, dto.reason);
  }

  @Post('request-revision')
  @UsePipes(new ZodValidationPipe(requestRevisionSchema))
  async requestRevision(
    @Param('contractId') contractId: string,
    @Body() dto: RequestRevisionDto,
    @Req() request: Request,
  ): Promise<void> {
    const tenantId = await this.tenantContext.getTenantId();
    const userId = (request.user as { userId: string }).userId;
    return this.negotiationApprovalService.requestRevision(tenantId, contractId, userId, dto.comment);
  }
}
