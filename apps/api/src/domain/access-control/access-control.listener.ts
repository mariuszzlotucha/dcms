import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EVENTS, EventPayloadMap } from '@';
import { AccessControlService } from './access-control.service';

@Injectable()
export class AccessControlListener {
  constructor(private readonly accessControlService: AccessControlService) {}

  // architecture doc 1.5 / 3: "tenant.created — sets a default access
  // policy for a new tenant."
  @OnEvent(EVENTS.TENANT_CREATED)
  async handleTenantCreated(event: EventPayloadMap[typeof EVENTS.TENANT_CREATED]): Promise<void> {
    await this.accessControlService.seedDefaultAccessPolicy(event.tenantId);
  }

  // architecture doc 1.5 / 3: "auth.user.registered — syncs a new user with
  // domain-level contract permissions." Concretely: resolves any pending
  // collaboration invites addressed to their email into real grants.
  @OnEvent(EVENTS.AUTH_USER_REGISTERED)
  async handleAuthUserRegistered(
    event: EventPayloadMap[typeof EVENTS.AUTH_USER_REGISTERED],
  ): Promise<void> {
    await this.accessControlService.resolvePendingInvites(
      event.tenantId,
      event.email,
      event.userId,
    );
  }
}
