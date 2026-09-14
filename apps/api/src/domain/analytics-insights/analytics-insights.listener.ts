import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EVENTS, EventPayloadMap } from '@';
import { AnalyticsInsightsService } from './analytics-insights.service';

@Injectable()
export class AnalyticsInsightsListener {
  constructor(private readonly analyticsInsightsService: AnalyticsInsightsService) {}

  @OnEvent(EVENTS.CONTRACT_STATUS_CHANGED)
  async handleContractStatusChanged(
    event: EventPayloadMap[typeof EVENTS.CONTRACT_STATUS_CHANGED],
  ): Promise<void> {
    await this.analyticsInsightsService.recordContractStatusChanged(
      event.tenantId,
      event.contractId,
      event.previousStatus,
      event.newStatus,
    );
  }

  @OnEvent(EVENTS.ESIGNATURE_COMPLETED)
  async handleEsignatureCompleted(
    event: EventPayloadMap[typeof EVENTS.ESIGNATURE_COMPLETED],
  ): Promise<void> {
    await this.analyticsInsightsService.recordEsignatureCompleted(event.tenantId);
  }

  @OnEvent(EVENTS.ESIGNATURE_EXPIRED)
  async handleEsignatureExpired(
    event: EventPayloadMap[typeof EVENTS.ESIGNATURE_EXPIRED],
  ): Promise<void> {
    await this.analyticsInsightsService.recordEsignatureExpired(event.tenantId);
  }

  @OnEvent(EVENTS.NEGOTIATION_REVISION_REQUESTED)
  async handleNegotiationRevisionRequested(
    event: EventPayloadMap[typeof EVENTS.NEGOTIATION_REVISION_REQUESTED],
  ): Promise<void> {
    await this.analyticsInsightsService.recordRevisionRequested(event.tenantId);
  }

  @OnEvent(EVENTS.BILLING_SUBSCRIPTION_UPDATED)
  async handleBillingSubscriptionUpdated(
    event: EventPayloadMap[typeof EVENTS.BILLING_SUBSCRIPTION_UPDATED],
  ): Promise<void> {
    await this.analyticsInsightsService.recordBillingSubscriptionUpdated(event.tenantId);
  }
}
