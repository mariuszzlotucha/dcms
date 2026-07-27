import { ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ThrottlerGuard, ThrottlerModuleOptions, ThrottlerStorage } from '@nestjs/throttler';
import { TenantContextService } from '@platform/tenants/context/tenant-context.service';
import { PLATFORM_EVENTS, PlatformEventPayloadMap } from '../../events';
import { RATE_LIMIT_CONFIG, RateLimitConfig } from '../rate-limiting.config';

@Injectable()
export class TenantThrottlerGuard extends ThrottlerGuard {
  constructor(
    options: ThrottlerModuleOptions,
    storageService: ThrottlerStorage,
    reflector: Reflector,
    private readonly tenantContext: TenantContextService,
    @Inject(RATE_LIMIT_CONFIG)
    private readonly rateLimitConfig: RateLimitConfig,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super(options, storageService, reflector);
  }

  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const tenantId = this.tryGetTenantId();
    if (tenantId) {
      return tenantId;
    }

    const apiKeyId = req.apiKeyId;
    if (typeof apiKeyId === 'string') {
      return apiKeyId;
    }

    return req.ip as string;
  }

  protected async throwThrottlingException(context: ExecutionContext): Promise<void> {
    const request = context.switchToHttp().getRequest();
    const key = await this.getTracker(request);

    this.eventEmitter.emit(
      PLATFORM_EVENTS.RATE_LIMIT_EXCEEDED,
      {
        tenantId: this.tryGetTenantId() ?? '',
        key,
        limit: this.rateLimitConfig.limit,
      } satisfies PlatformEventPayloadMap[typeof PLATFORM_EVENTS.RATE_LIMIT_EXCEEDED],
    );

    return super.throwThrottlingException(context);
  }

  private tryGetTenantId(): string | null {
    try {
      return this.tenantContext.getTenantId();
    } catch {
      return null;
    }
  }
}
