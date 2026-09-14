import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EVENTS, EventPayloadMap } from '@';
import { PREMIUM_TEMPLATES_FLAG } from './templates.seed';
import { TemplatesService } from './templates.service';

@Injectable()
export class TemplatesListener {
  constructor(private readonly templatesService: TemplatesService) {}

  // architecture doc 1.2 / 3: "tenant.created — seeds a default set of
  // starter templates for a new tenant."
  @OnEvent(EVENTS.TENANT_CREATED)
  async handleTenantCreated(
    event: EventPayloadMap[typeof EVENTS.TENANT_CREATED],
  ): Promise<void> {
    await this.templatesService.seedStarterTemplates(event.tenantId);
  }

  // architecture doc 1.2 / 3: "featureFlag.toggled — unlocks premium/industry
  // templates."
  @OnEvent(EVENTS.FEATURE_FLAG_TOGGLED)
  async handleFeatureFlagToggled(
    event: EventPayloadMap[typeof EVENTS.FEATURE_FLAG_TOGGLED],
  ): Promise<void> {
    if (event.flagKey !== PREMIUM_TEMPLATES_FLAG || !event.enabled) {
      return;
    }

    await this.templatesService.seedPremiumTemplates(event.tenantId);
  }
}
