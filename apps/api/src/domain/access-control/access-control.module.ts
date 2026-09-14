import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessPolicy } from './entities/access-policy.entity';
import { CollaborationInvite } from './entities/collaboration-invite.entity';
import { CollaborationSession } from './entities/collaboration-session.entity';
import { ContractAccessGrant } from './entities/contract-access-grant.entity';
import { ContractComment } from './entities/contract-comment.entity';
import { AccessControlController } from './access-control.controller';
import { AccessControlListener } from './access-control.listener';
import { AccessControlService } from './access-control.service';
import { CollaborationController } from './collaboration.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AccessPolicy,
      ContractAccessGrant,
      CollaborationInvite,
      ContractComment,
      CollaborationSession,
    ]),
  ],
  controllers: [AccessControlController, CollaborationController],
  providers: [AccessControlService, AccessControlListener],
  exports: [AccessControlService],
})
export class AccessControlModule {}
