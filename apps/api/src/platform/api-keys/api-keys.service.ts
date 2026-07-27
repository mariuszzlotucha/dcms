import { randomBytes, createHash } from 'crypto';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PLATFORM_EVENTS, PlatformEventPayloadMap } from '../events';
import { ApiKey } from './entities/api-key.entity';
import { API_KEYS_MODULE_CONFIG, ApiKeysModuleConfig } from './api-keys.config';

type ApiKeyListItem = Omit<ApiKey, 'keyHash'>;

@Injectable()
export class ApiKeysService {
  constructor(
    @InjectRepository(ApiKey)
    private readonly apiKeys: Repository<ApiKey>,
    @Inject(API_KEYS_MODULE_CONFIG)
    private readonly config: ApiKeysModuleConfig,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createKey(tenantId: string, label: string, scopes: string[]): Promise<{ id: string; rawKey: string }> {
    const rawKey = `${this.config.keyPrefix}${randomBytes(32).toString('base64url')}`;
    const keyHash = createHash('sha256').update(rawKey).digest('hex');

    const apiKey = await this.apiKeys.save(
      this.apiKeys.create({ tenantId, keyHash, scopes, label, revokedAt: null }),
    );

    this.eventEmitter.emit(
      PLATFORM_EVENTS.API_KEY_CREATED,
      { id: apiKey.id, tenantId } satisfies PlatformEventPayloadMap[typeof PLATFORM_EVENTS.API_KEY_CREATED],
    );

    return { id: apiKey.id, rawKey };
  }

  async listKeys(tenantId: string): Promise<ApiKeyListItem[]> {
    const keys = await this.apiKeys.find({ where: { tenantId } });
    return keys.map(({ keyHash: _keyHash, ...rest }) => rest);
  }

  async revokeKey(tenantId: string, keyId: string): Promise<void> {
    const apiKey = await this.apiKeys.findOne({ where: { id: keyId, tenantId } });

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    apiKey.revokedAt = new Date();
    await this.apiKeys.save(apiKey);

    this.eventEmitter.emit(
      PLATFORM_EVENTS.API_KEY_REVOKED,
      { id: apiKey.id, tenantId } satisfies PlatformEventPayloadMap[typeof PLATFORM_EVENTS.API_KEY_REVOKED],
    );
  }
}
