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

    this.eventEmitter.emit(
      PLATFORM_EVENTS.RBAC_ROLE_ASSIGNED,
      { userId, tenantId, role } satisfies PlatformEventPayloadMap[typeof PLATFORM_EVENTS.RBAC_ROLE_ASSIGNED],
    );

    return saved;
  }

  async getRole(userId: string, tenantId: string): Promise<RbacRole> {
    const assignment = await this.roleAssignments.findOne({ where: { userId, tenantId } });
    return assignment?.role ?? this.config.defaultRole;
  }

  async hasRole(userId: string, tenantId: string, requiredRole: RbacRole): Promise<boolean> {
    const role = await this.getRole(userId, tenantId);
    return RBAC_ROLE_HIERARCHY[role] >= RBAC_ROLE_HIERARCHY[requiredRole];
  }
}
