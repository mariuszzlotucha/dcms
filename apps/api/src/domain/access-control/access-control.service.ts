import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { EVENTS, EventPayloadMap } from '@';
import type { AccessPermission } from '@contracts/access-control.schema';
import { AccessPolicy } from './entities/access-policy.entity';
import { CollaborationInvite } from './entities/collaboration-invite.entity';
import { CollaborationSession } from './entities/collaboration-session.entity';
import { ContractAccessGrant } from './entities/contract-access-grant.entity';
import { ContractComment } from './entities/contract-comment.entity';

const DEFAULT_PERMISSION: AccessPermission = 'view';

@Injectable()
export class AccessControlService {
  constructor(
    @InjectRepository(AccessPolicy)
    private readonly accessPolicies: Repository<AccessPolicy>,
    @InjectRepository(ContractAccessGrant)
    private readonly accessGrants: Repository<ContractAccessGrant>,
    @InjectRepository(CollaborationInvite)
    private readonly invites: Repository<CollaborationInvite>,
    @InjectRepository(ContractComment)
    private readonly comments: Repository<ContractComment>,
    @InjectRepository(CollaborationSession)
    private readonly sessions: Repository<CollaborationSession>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async grantAccess(
    tenantId: string,
    contractId: string,
    userId: string,
    permission: AccessPermission,
    grantedBy: string,
  ): Promise<ContractAccessGrant> {
    let grant = await this.accessGrants.findOne({ where: { tenantId, contractId, userId } });

    if (grant) {
      grant.permission = permission;
      grant.grantedBy = grantedBy;
    } else {
      grant = this.accessGrants.create({ tenantId, contractId, userId, permission, grantedBy });
    }

    const saved = await this.accessGrants.save(grant);

    this.eventEmitter.emit(
      EVENTS.ACCESS_GRANTED,
      { contractId, tenantId, userId, permission } satisfies EventPayloadMap[typeof EVENTS.ACCESS_GRANTED],
    );

    return saved;
  }

  async revokeAccess(tenantId: string, contractId: string, userId: string): Promise<void> {
    const grant = await this.accessGrants.findOne({ where: { tenantId, contractId, userId } });

    if (!grant) {
      throw new NotFoundException('Access grant not found');
    }

    await this.accessGrants.remove(grant);

    this.eventEmitter.emit(
      EVENTS.ACCESS_REVOKED,
      { contractId, tenantId, userId } satisfies EventPayloadMap[typeof EVENTS.ACCESS_REVOKED],
    );
  }

  async listAccess(tenantId: string, contractId: string): Promise<ContractAccessGrant[]> {
    return this.accessGrants.find({ where: { tenantId, contractId } });
  }

  async inviteParticipant(
    tenantId: string,
    contractId: string,
    invitedEmail: string,
    permission: AccessPermission,
    invitedBy: string,
  ): Promise<CollaborationInvite> {
    const invite = await this.invites.save(
      this.invites.create({ tenantId, contractId, invitedEmail, permission, invitedBy, resolvedAt: null }),
    );

    this.eventEmitter.emit(
      EVENTS.COLLABORATION_PARTICIPANT_INVITED,
      {
        contractId,
        tenantId,
        invitedEmail,
        invitedBy,
      } satisfies EventPayloadMap[typeof EVENTS.COLLABORATION_PARTICIPANT_INVITED],
    );

    return invite;
  }

  async addComment(tenantId: string, contractId: string, authorId: string, body: string): Promise<ContractComment> {
    const comment = await this.comments.save(this.comments.create({ tenantId, contractId, authorId, body }));

    this.eventEmitter.emit(
      EVENTS.COLLABORATION_COMMENT_ADDED,
      {
        contractId,
        tenantId,
        commentId: comment.id,
        authorId,
      } satisfies EventPayloadMap[typeof EVENTS.COLLABORATION_COMMENT_ADDED],
    );

    return comment;
  }

  async listComments(tenantId: string, contractId: string): Promise<ContractComment[]> {
    return this.comments.find({ where: { tenantId, contractId }, order: { createdAt: 'ASC' } });
  }

  async startSession(tenantId: string, contractId: string, userId: string): Promise<CollaborationSession> {
    const session = await this.sessions.save(this.sessions.create({ tenantId, contractId, userId }));

    this.eventEmitter.emit(
      EVENTS.COLLABORATION_SESSION_STARTED,
      { contractId, tenantId, userId } satisfies EventPayloadMap[typeof EVENTS.COLLABORATION_SESSION_STARTED],
    );

    return session;
  }

  // Invoked from AccessControlListener on tenant.created. Idempotent: skips
  // tenants that already have a policy row.
  async seedDefaultAccessPolicy(tenantId: string): Promise<void> {
    const existing = await this.accessPolicies.findOne({ where: { tenantId } });

    if (existing) {
      return;
    }

    await this.accessPolicies.save(this.accessPolicies.create({ tenantId, defaultPermission: DEFAULT_PERMISSION }));
  }

  // Invoked from AccessControlListener on auth.user.registered — "syncs a
  // new user with domain-level contract permissions" by converting any
  // pending invites addressed to their email into real grants.
  async resolvePendingInvites(tenantId: string, email: string, userId: string): Promise<void> {
    const pending = await this.invites.find({
      where: { tenantId, invitedEmail: email, resolvedAt: IsNull() },
    });

    for (const invite of pending) {
      await this.grantAccess(tenantId, invite.contractId, userId, invite.permission, invite.invitedBy);
      invite.resolvedAt = new Date();
      await this.invites.save(invite);
    }
  }
}
