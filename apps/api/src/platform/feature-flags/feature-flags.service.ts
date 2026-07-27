import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PLATFORM_EVENTS, PlatformEventPayloadMap } from '../events';
import { FeatureFlag } from './entities/feature-flag.entity';
import { FEATURE_FLAGS_MODULE_CONFIG, FeatureFlagsModuleConfig } from './feature-flags.config';

@Injectable()
export class FeatureFlagsService {
  constructor(
    @InjectRepository(FeatureFlag)
    private readonly featureFlags: Repository<FeatureFlag>,
    @Inject(FEATURE_FLAGS_MODULE_CONFIG)
    private readonly config: FeatureFlagsModuleConfig,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async isEnabled(tenantId: string, flagKey: string): Promise<boolean> {
    const row = await this.featureFlags.findOne({ where: { tenantId, flagKey } });

    if (row) {
      return row.enabled;
    }

    return this.config.defaultFlags?.[flagKey] ?? false;
  }

  async setFlag(tenantId: string, flagKey: string, enabled: boolean): Promise<FeatureFlag> {
    const existing = await this.featureFlags.findOne({ where: { tenantId, flagKey } });

    if (existing && existing.enabled === enabled) {
      return existing;
    }

    const record = existing ?? this.featureFlags.create({ tenantId, flagKey, enabled });
    record.enabled = enabled;
    const saved = await this.featureFlags.save(record);

    this.eventEmitter.emit(
      PLATFORM_EVENTS.FEATURE_FLAG_TOGGLED,
      { tenantId, flagKey, enabled } satisfies PlatformEventPayloadMap[typeof PLATFORM_EVENTS.FEATURE_FLAG_TOGGLED],
    );

    return saved;
  }

  async listFlags(tenantId: string): Promise<Record<string, boolean>> {
    const rows = await this.featureFlags.find({ where: { tenantId } });
    const resolved: Record<string, boolean> = { ...(this.config.defaultFlags ?? {}) };

    for (const row of rows) {
      resolved[row.flagKey] = row.enabled;
    }

    return resolved;
  }
}
