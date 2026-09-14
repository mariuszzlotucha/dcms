import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PLATFORM_EVENTS, PlatformEventPayloadMap } from '../events';
import { RoleAssignment } from './entities/role-assignment.entity';
import { RBAC_MODULE_CONFIG, RBAC_ROLE_HIERARCHY, RbacModuleConfig, RbacRole } from './rbac.config';

@Injectable()
export class RbacService {
  constructor(
    @InjectRepository(RoleAssignment)
    private readonly roleAssignments: Repository<RoleAssignment>,
    @Inject(RBAC_MODULE_CONFIG)
    private readonly config: RbacModuleConfig,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async assignRole(userId: string, tenantId: string, role: RbacRole): Promise<RoleAssignment> {
    let assignment = await this.roleAssignments.findOne({ where: { userId, tenantId } });

    if (assignment) {
      assignment.role = role;
    } else {
      assignment = this.roleAssignments.create({ userId, tenantId, role });
    }

    const saved = await this.roleAssignments.save(assignment);

    this.eventEmitter.emit(PLATFORM_EVENTS.RBAC_ROLE_ASSIGNED, {
      userId,
      tenantId,
      role,
    } satisfies PlatformEventPayloadMap[typeof PLATFORM_EVENTS.RBAC_ROLE_ASSIGNED]);

    return saved;
  }

  async getRole(userId: string, tenantId: string): Promise<RbacRole> {
    const assignment = await this.roleAssignments.findOne({ where: { userId, tenantId } });
    return assignment?.role ?? this.config.defaultRole;
  }

  // The authoritative "does this user belong to this tenant at all" check.
  // Deliberately not derived from getRole()/hasRole(): those fall back to
  // config.defaultRole when no assignment row exists, which is meant for
  // ranking a known member's role, not for deciding whether a user may
  // access a tenant in the first place.
  async isMember(userId: string, tenantId: string): Promise<boolean> {
    const assignment = await this.roleAssignments.findOne({ where: { userId, tenantId } });
    return assignment != null;
  }

  async hasRole(userId: string, tenantId: string, requiredRole: RbacRole): Promise<boolean> {
    const role = await this.getRole(userId, tenantId);
    return RBAC_ROLE_HIERARCHY[role] >= RBAC_ROLE_HIERARCHY[requiredRole];
  }
}
