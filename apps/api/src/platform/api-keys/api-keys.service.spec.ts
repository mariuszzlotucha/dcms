import { createHash } from 'crypto';
import { NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PLATFORM_EVENTS } from '../events';
import { ApiKeysService } from './api-keys.service';
import { ApiKeysModuleConfig } from './api-keys.config';
import { ApiKey } from './entities/api-key.entity';

describe('ApiKeysService', () => {
  let apiKeys: { save: jest.Mock; create: jest.Mock; find: jest.Mock; findOne: jest.Mock };
  let eventEmitter: { emit: jest.Mock };
  let service: ApiKeysService;

  const config: ApiKeysModuleConfig = { keyPrefix: 'dcms_live_' };

  beforeEach(() => {
    apiKeys = {
      save: jest.fn(async (data) => ({ id: 'k1', ...data }) as ApiKey),
      create: jest.fn((data) => data),
      find: jest.fn(),
      findOne: jest.fn(),
    };
    eventEmitter = { emit: jest.fn() };

    service = new ApiKeysService(
      apiKeys as never,
      config,
      eventEmitter as unknown as EventEmitter2,
    );
  });

  describe('createKey', () => {
    it('returns a raw key prefixed with the configured prefix', async () => {
      const result = await service.createKey('t1', 'CI key', ['read']);

      expect(result.rawKey.startsWith('dcms_live_')).toBe(true);
    });

    it('stores only the sha256 hash of the raw key, never the raw value', async () => {
      const result = await service.createKey('t1', 'CI key', ['read']);

      const expectedHash = createHash('sha256').update(result.rawKey).digest('hex');
      expect(apiKeys.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 't1',
          keyHash: expectedHash,
          scopes: ['read'],
          label: 'CI key',
        }),
      );
      expect(apiKeys.create).not.toHaveBeenCalledWith(
        expect.objectContaining({ keyHash: result.rawKey }),
      );
    });

    it('generates a different key on each call', async () => {
      const first = await service.createKey('t1', 'a', []);
      const second = await service.createKey('t1', 'b', []);

      expect(first.rawKey).not.toBe(second.rawKey);
    });

    it('emits API_KEY_CREATED with the tenant, key id, and scopes', async () => {
      const result = await service.createKey('t1', 'CI key', ['read', 'write']);

      expect(eventEmitter.emit).toHaveBeenCalledWith(PLATFORM_EVENTS.API_KEY_CREATED, {
        tenantId: 't1',
        keyId: result.id,
        scopes: ['read', 'write'],
      });
    });
  });

  describe('listKeys', () => {
    it('scopes the query to the tenant and never returns the key hash', async () => {
      apiKeys.find.mockResolvedValue([
        {
          id: 'k1',
          tenantId: 't1',
          keyHash: 'secret-hash',
          scopes: [],
          label: 'a',
          revokedAt: null,
        },
      ]);

      const result = await service.listKeys('t1');

      expect(apiKeys.find).toHaveBeenCalledWith({ where: { tenantId: 't1' } });
      expect(result).toEqual([
        { id: 'k1', tenantId: 't1', scopes: [], label: 'a', revokedAt: null },
      ]);
      expect(result[0]).not.toHaveProperty('keyHash');
    });
  });

  describe('revokeKey', () => {
    it('throws NotFoundException when the key does not belong to the tenant', async () => {
      apiKeys.findOne.mockResolvedValue(null);

      await expect(service.revokeKey('t1', 'k1')).rejects.toThrow(NotFoundException);
    });

    it('sets revokedAt and emits API_KEY_REVOKED', async () => {
      const apiKey = { id: 'k1', tenantId: 't1', revokedAt: null } as ApiKey;
      apiKeys.findOne.mockResolvedValue(apiKey);

      await service.revokeKey('t1', 'k1');

      expect(apiKeys.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'k1', revokedAt: expect.any(Date) }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(PLATFORM_EVENTS.API_KEY_REVOKED, {
        tenantId: 't1',
        keyId: 'k1',
      });
    });
  });
});
