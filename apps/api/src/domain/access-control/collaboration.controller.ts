import { Body, Controller, Get, Param, Post, Req, UseGuards, UsePipes } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '@platform/auth/guards/jwt-auth.guard';
import { ZodValidationPipe } from '@platform/security/pipes/zod-validation.pipe';
import { TenantContextService } from '@platform/tenants/context/tenant-context.service';
import { AddCommentDto, addCommentSchema } from '@contracts/access-control.schema';
import { AccessControlService } from './access-control.service';
import { CollaborationSession } from './entities/collaboration-session.entity';
import { ContractComment } from './entities/contract-comment.entity';

@Controller('contracts/:contractId/collaboration')
@UseGuards(JwtAuthGuard)
export class CollaborationController {
  constructor(
    private readonly accessControlService: AccessControlService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Post('comments')
  @UsePipes(new ZodValidationPipe(addCommentSchema))
  async addComment(
    @Param('contractId') contractId: string,
    @Body() dto: AddCommentDto,
    @Req() request: Request,
  ): Promise<ContractComment> {
    const tenantId = await this.tenantContext.getTenantId();
    const authorId = (request.user as { userId: string }).userId;
    return this.accessControlService.addComment(tenantId, contractId, authorId, dto.body);
  }

  @Get('comments')
  async listComments(@Param('contractId') contractId: string): Promise<ContractComment[]> {
    const tenantId = await this.tenantContext.getTenantId();
    return this.accessControlService.listComments(tenantId, contractId);
  }

  @Post('sessions')
  async startSession(@Param('contractId') contractId: string, @Req() request: Request): Promise<CollaborationSession> {
    const tenantId = await this.tenantContext.getTenantId();
    const userId = (request.user as { userId: string }).userId;
    return this.accessControlService.startSession(tenantId, contractId, userId);
  }
}
