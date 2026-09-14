import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EVENTS, EventPayloadMap } from '@';
import { INTEGRATIONS_FLAG, IntegrationsService } from './integrations.service';

@Injectable()
export class IntegrationsListener {
  constructor(private readonly integrationsService: IntegrationsService) {}

  // architecture doc 1.9 / 3: "tenant.created — initializes an empty
  // integration configuration for a new tenant."
  @OnEvent(EVENTS.TENANT_CREATED)
  async handleTenantCreated(event: EventPayloadMap[typeof EVENTS.TENANT_CREATED]): Promise<void> {
    await this.integrationsService.initializeTenantConfig(event.tenantId);
  }

  // architecture doc 1.9 / 3: "featureFlag.toggled — controls integration
  // availability as a premium/enterprise feature."
  @OnEvent(EVENTS.FEATURE_FLAG_TOGGLED)
  async handleFeatureFlagToggled(event: EventPayloadMap[typeof EVENTS.FEATURE_FLAG_TOGGLED]): Promise<void> {
    if (event.flagKey !== INTEGRATIONS_FLAG || event.enabled) {
      return;
    }

    await this.integrationsService.handleFeatureFlagDisabled(event.tenantId);
  }

  @OnEvent(EVENTS.CONTRACT_CREATED)
  async handleContractCreated(event: EventPayloadMap[typeof EVENTS.CONTRACT_CREATED]): Promise<void> {
    await this.integrationsService.requestSync(event.tenantId, event.contractId);
  }

  @OnEvent(EVENTS.CONTRACT_STATUS_CHANGED)
  async handleContractStatusChanged(event: EventPayloadMap[typeof EVENTS.CONTRACT_STATUS_CHANGED]): Promise<void> {
    await this.integrationsService.requestSync(event.tenantId, event.contractId);
  }
}
