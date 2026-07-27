import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ThrottlerGuard, ThrottlerModuleOptions, ThrottlerStorage } from '@nestjs/throttler';
import { TenantContextService } from '@platform/tenants/context/tenant-context.service';
import { PLATFORM_EVENTS, PlatformEventPayloadMap } from '../../events';

@Injectable()
export class TenantThrottlerGuard extends ThrottlerGuard {
  constructor(
    options: ThrottlerModuleOptions,
    storageService: ThrottlerStorage,
    reflector: Reflector,
    private readonly tenantContext: TenantContextService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super(options, storageService, reflector);
  }

  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    try {
      return this.tenantContext.getTenantId();
    } catch {
      const apiKeyId = req.apiKeyId;
      if (typeof apiKeyId === 'string') {
        return apiKeyId;
      }
      return req.ip as string;
    }
  }

  protected async throwThrottlingException(context: ExecutionContext): Promise<void> {
    const tracker = await this.getTracker(context.switchToHttp().getRequest());

    this.eventEmitter.emit(
      PLATFORM_EVENTS.RATE_LIMIT_EXCEEDED,
      { tracker } satisfies PlatformEventPayloadMap[typeof PLATFORM_EVENTS.RATE_LIMIT_EXCEEDED],
    );

    return super.throwThrottlingException(context);
  }
}
