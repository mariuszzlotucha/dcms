import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards, UsePipes } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '@platform/auth/guards/jwt-auth.guard';
import { Roles } from '@platform/rbac/decorators/roles.decorator';
import { RolesGuard } from '@platform/rbac/guards/roles.guard';
import { ZodValidationPipe } from '@platform/security/pipes/zod-validation.pipe';
import { TenantContextService } from '@platform/tenants/context/tenant-context.service';
import {
  GrantAccessDto,
  grantAccessSchema,
  InviteParticipantDto,
  inviteParticipantSchema,
} from '@contracts/access-control.schema';
import { AccessControlService } from './access-control.service';
import { CollaborationInvite } from './entities/collaboration-invite.entity';
import { ContractAccessGrant } from './entities/contract-access-grant.entity';

@Controller('contracts/:contractId/access')
@UseGuards(JwtAuthGuard)
export class AccessControlController {
  constructor(
    private readonly accessControlService: AccessControlService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Post('grants')
  @Roles('owner', 'admin')
  @UseGuards(RolesGuard)
  @UsePipes(new ZodValidationPipe(grantAccessSchema))
  async grantAccess(
    @Param('contractId') contractId: string,
    @Body() dto: GrantAccessDto,
    @Req() request: Request,
  ): Promise<ContractAccessGrant> {
    const tenantId = await this.tenantContext.getTenantId();
    const grantedBy = (request.user as { userId: string }).userId;
    return this.accessControlService.grantAccess(tenantId, contractId, dto.userId, dto.permission, grantedBy);
  }

  @Delete('grants/:userId')
  @Roles('owner', 'admin')
  @UseGuards(RolesGuard)
  async revokeAccess(@Param('contractId') contractId: string, @Param('userId') userId: string): Promise<void> {
    const tenantId = await this.tenantContext.getTenantId();
    return this.accessControlService.revokeAccess(tenantId, contractId, userId);
  }

  @Get('grants')
  async listAccess(@Param('contractId') contractId: string): Promise<ContractAccessGrant[]> {
    const tenantId = await this.tenantContext.getTenantId();
    return this.accessControlService.listAccess(tenantId, contractId);
  }

  @Post('invitations')
  @Roles('owner', 'admin')
  @UseGuards(RolesGuard)
  @UsePipes(new ZodValidationPipe(inviteParticipantSchema))
  async inviteParticipant(
    @Param('contractId') contractId: string,
    @Body() dto: InviteParticipantDto,
    @Req() request: Request,
  ): Promise<CollaborationInvite> {
    const tenantId = await this.tenantContext.getTenantId();
    const invitedBy = (request.user as { userId: string }).userId;
    return this.accessControlService.inviteParticipant(tenantId, contractId, dto.email, dto.permission, invitedBy);
  }
}
