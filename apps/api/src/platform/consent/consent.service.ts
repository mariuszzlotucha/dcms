import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PLATFORM_EVENTS, PlatformEventPayloadMap } from '../events';
import { ConsentRecord } from './entities/consent-record.entity';
import { CONSENT_MODULE_CONFIG, ConsentModuleConfig } from './consent.config';

export type ConsentState = 'never_granted' | 'current' | 'outdated' | 'revoked';

export interface ConsentStatus {
  consentType: string;
  state: ConsentState;
  version: string | null;
  grantedAt: Date | null;
  revokedAt: Date | null;
}

@Injectable()
export class ConsentService {
  constructor(
    @InjectRepository(ConsentRecord)
    private readonly consentRecords: Repository<ConsentRecord>,
    @Inject(CONSENT_MODULE_CONFIG)
    private readonly config: ConsentModuleConfig,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async grant(userId: string, tenantId: string, consentType: string): Promise<ConsentRecord> {
    const version = this.config.currentVersions[consentType];

    const record = await this.consentRecords.save(
      this.consentRecords.create({
        userId,
        tenantId,
        consentType,
        version,
        grantedAt: new Date(),
        revokedAt: null,
      }),
    );

    this.eventEmitter.emit(
      PLATFORM_EVENTS.CONSENT_GRANTED,
      { userId, tenantId, consentType, version } satisfies PlatformEventPayloadMap[typeof PLATFORM_EVENTS.CONSENT_GRANTED],
    );

    return record;
  }

  async revoke(userId: string, tenantId: string, consentType: string): Promise<ConsentRecord> {
    const version = this.config.currentVersions[consentType];

    const record = await this.consentRecords.save(
      this.consentRecords.create({
        userId,
        tenantId,
        consentType,
        version,
        grantedAt: null,
        revokedAt: new Date(),
      }),
    );

    this.eventEmitter.emit(
      PLATFORM_EVENTS.CONSENT_REVOKED,
      { tenantId, userId, consentType } satisfies PlatformEventPayloadMap[typeof PLATFORM_EVENTS.CONSENT_REVOKED],
    );

    return record;
  }

  async getStatus(userId: string, tenantId: string, consentType: string): Promise<ConsentStatus> {
    const records = await this.consentRecords.find({ where: { userId, tenantId, consentType } });

    if (records.length === 0) {
      return { consentType, state: 'never_granted', version: null, grantedAt: null, revokedAt: null };
    }

    const mostRecent = records.reduce((latest, record) => {
      const latestAt = (latest.grantedAt ?? latest.revokedAt) as Date;
      const recordAt = (record.grantedAt ?? record.revokedAt) as Date;
      return recordAt > latestAt ? record : latest;
    });

    if (mostRecent.revokedAt) {
      return {
        consentType,
        state: 'revoked',
        version: mostRecent.version,
        grantedAt: null,
        revokedAt: mostRecent.revokedAt,
      };
    }

    const currentVersion = this.config.currentVersions[consentType];
    return {
      consentType,
      state: mostRecent.version === currentVersion ? 'current' : 'outdated',
      version: mostRecent.version,
      grantedAt: mostRecent.grantedAt,
      revokedAt: null,
    };
  }

  async getAllStatuses(userId: string, tenantId: string): Promise<ConsentStatus[]> {
    return Promise.all(
      Object.keys(this.config.currentVersions).map((consentType) => this.getStatus(userId, tenantId, consentType)),
    );
  }
}
