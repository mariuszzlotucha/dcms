import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EVENTS } from '@';
import { ComplianceReportingService } from './compliance-reporting.service';

// architecture doc 1.6: "Listens to (domain): essentially all events from
// contracts, esignature, negotiation-approval, access-control — builds its
// own compliance trail from them." Rather than 22 near-identical @OnEvent
// handlers, this mirrors platform/audit's AuditListener: a single onAny
// wildcard subscription, filtered down to the modules this doc actually names.
const RELEVANT_EVENTS = new Set<string>([
  EVENTS.CONTRACT_CREATED,
  EVENTS.CONTRACT_UPDATED,
  EVENTS.CONTRACT_VERSION_CREATED,
  EVENTS.CONTRACT_STATUS_CHANGED,
  EVENTS.CONTRACT_SUBMITTED_FOR_APPROVAL,
  EVENTS.CONTRACT_ARCHIVED,
  EVENTS.CONTRACT_DELETED,
  EVENTS.APPROVAL_REQUESTED,
  EVENTS.APPROVAL_GRANTED,
  EVENTS.APPROVAL_REJECTED,
  EVENTS.NEGOTIATION_REVISION_REQUESTED,
  EVENTS.NEGOTIATION_ROLE_ASSIGNED,
  EVENTS.ESIGNATURE_REQUESTED,
  EVENTS.ESIGNATURE_SENT,
  EVENTS.ESIGNATURE_COMPLETED,
  EVENTS.ESIGNATURE_DECLINED,
  EVENTS.ESIGNATURE_EXPIRED,
  EVENTS.ACCESS_GRANTED,
  EVENTS.ACCESS_REVOKED,
  EVENTS.COLLABORATION_PARTICIPANT_INVITED,
  EVENTS.COLLABORATION_COMMENT_ADDED,
  EVENTS.COLLABORATION_SESSION_STARTED,
]);

@Injectable()
export class ComplianceReportingListener implements OnModuleInit {
  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly complianceReportingService: ComplianceReportingService,
  ) {}

  onModuleInit(): void {
    this.eventEmitter.onAny((event: string | string[], ...values: unknown[]) => {
      void this.handleEvent(Array.isArray(event) ? event.join('.') : event, values[0]);
    });
  }

  async handleEvent(eventName: string, payload: unknown): Promise<void> {
    if (!RELEVANT_EVENTS.has(eventName)) {
      return;
    }

    if (typeof payload !== 'object' || payload === null) {
      return;
    }

    const record = payload as Record<string, unknown>;
    const tenantId = typeof record.tenantId === 'string' ? record.tenantId : null;
    const contractId = typeof record.contractId === 'string' ? record.contractId : null;

    if (!tenantId || !contractId) {
      return;
    }

    await this.complianceReportingService.recordEvent(tenantId, contractId, eventName, payload);
  }
}
