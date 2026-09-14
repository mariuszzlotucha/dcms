import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApprovalRequest } from './entities/approval-request.entity';
import { ApprovalWorkflow } from './entities/approval-workflow.entity';
import { NegotiationRoleAssignment } from './entities/negotiation-role-assignment.entity';
import { NegotiationApprovalController } from './negotiation-approval.controller';
import { NegotiationApprovalListener } from './negotiation-approval.listener';
import { NegotiationApprovalService } from './negotiation-approval.service';

@Module({
  imports: [TypeOrmModule.forFeature([NegotiationRoleAssignment, ApprovalRequest, ApprovalWorkflow])],
  controllers: [NegotiationApprovalController],
  providers: [NegotiationApprovalService, NegotiationApprovalListener],
  exports: [NegotiationApprovalService],
})
export class NegotiationApprovalModule {}
