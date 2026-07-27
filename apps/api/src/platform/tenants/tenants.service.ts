import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RbacService } from '@platform/rbac/rbac.service';
import { PLATFORM_EVENTS, PlatformEventPayloadMap } from '../events';
import { Tenant } from './entities/tenant.entity';
import { TENANTS_MODULE_CONFIG, TenantsModuleConfig } from './tenants.config';

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenants: Repository<Tenant>,
    @Inject(TENANTS_MODULE_CONFIG)
    private readonly config: TenantsModuleConfig,
    private readonly rbacService: RbacService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createTenant(name: string, creatorUserId: string): Promise<Tenant> {
    const tenant = await this.tenants.save(
      this.tenants.create({ name, plan: this.config.defaultPlan }),
    );

    await this.rbacService.assignRole(creatorUserId, tenant.id, 'owner');

    this.eventEmitter.emit(
      PLATFORM_EVENTS.TENANT_CREATED,
      { tenantId: tenant.id, name: tenant.name, creatorUserId } satisfies PlatformEventPayloadMap[typeof PLATFORM_EVENTS.TENANT_CREATED],
    );

    return tenant;
  }

  async getTenant(tenantId: string): Promise<Tenant> {
    const tenant = await this.tenants.findOne({ where: { id: tenantId } });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }
}
