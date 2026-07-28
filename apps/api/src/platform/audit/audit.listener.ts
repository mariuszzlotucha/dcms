import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuditService } from './audit.module';
import { AUDIT_MODULE_CONFIG, AuditModuleConfig } from './audit.config';

@Injectable()
export class AuditListener implements OnModuleInit {
  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly auditService: AuditService,
    @Inject(AUDIT_MODULE_CONFIG)
    private readonly config: AuditModuleConfig,
  ) {}

  onModuleInit(): void {
    this.eventEmitter.onAny((event: string | string[], ...values: unknown[]) => {
      void this.handleEvent(event, values[0]);
    });
  }

  private async handleEvent(event: string | string[], payload: unknown): Promise<void> {
    const eventName = Array.isArray(event) ? event.join('.') : event;

    if (this.config.excludedEvents?.includes(eventName)) {
      return;
    }

    const { actorId, tenantId } = this.extractActorAndTenant(payload);
    await this.auditService.record(eventName, actorId, tenantId, payload);
  }

  private extractActorAndTenant(payload: unknown): { actorId: string | null; tenantId: string | null } {
    if (typeof payload !== 'object' || payload === null) {
      return { actorId: null, tenantId: null };
    }

    const record = payload as Record<string, unknown>;
    const actorId = this.pickString(record.actorId) ?? this.pickString(record.userId);
    const tenantId = this.pickString(record.tenantId);

    return { actorId, tenantId };
  }

  private pickString(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
  }
}
