import { ForbiddenException } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';
import { IntegrationConnection } from './entities/integration-connection.entity';

describe('IntegrationsService', () => {
  let connections: { find: jest.Mock; findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let circuitBreakerRegistry: { wrap: jest.Mock };
  let deadLetterQueueService: { add: jest.Mock };
  let featureFlagsService: { isEnabled: jest.Mock };
  let eventEmitter: { emit: jest.Mock };
  let service: IntegrationsService;

  beforeEach(() => {
    connections = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((data) => data as IntegrationConnection),
      save: jest.fn(async (data) => (Array.isArray(data) ? data : { id: 'conn-1', ...data })),
    };
    circuitBreakerRegistry = { wrap: jest.fn((_name: string, fn: () => Promise<unknown>) => fn()) };
    deadLetterQueueService = { add: jest.fn() };
    featureFlagsService = { isEnabled: jest.fn().mockResolvedValue(true) };
    eventEmitter = { emit: jest.fn() };

    service = new IntegrationsService(
      connections as never,
      circuitBreakerRegistry as never,
      deadLetterQueueService as never,
      featureFlagsService as never,
      eventEmitter as never,
    );
  });

  describe('initializeTenantConfig', () => {
    it('creates a disabled connection row for every integration type when none exist', async () => {
      await service.initializeTenantConfig('t1');

      expect(connections.save).toHaveBeenCalledWith([
        expect.objectContaining({ tenantId: 't1', integration: 'salesforce', enabled: false }),
        expect.objectContaining({ tenantId: 't1', integration: 'hubspot', enabled: false }),
        expect.objectContaining({ tenantId: 't1', integration: 'google-drive', enabled: false }),
        expect.objectContaining({ tenantId: 't1', integration: 'ms365', enabled: false }),
      ]);
    });

    it('skips creation entirely when every integration type already has a row', async () => {
      connections.find.mockResolvedValue([
        { integration: 'salesforce' },
        { integration: 'hubspot' },
        { integration: 'google-drive' },
        { integration: 'ms365' },
      ]);

      await service.initializeTenantConfig('t1');

      expect(connections.save).not.toHaveBeenCalled();
    });
  });

  describe('connect', () => {
    it('rejects when the integrations feature flag is disabled for the tenant', async () => {
      featureFlagsService.isEnabled.mockResolvedValue(false);

      await expect(service.connect('t1', 'salesforce', 'https://example.com/hook')).rejects.toThrow(
        ForbiddenException,
      );
      expect(connections.save).not.toHaveBeenCalled();
    });

    it('enables the connection and stores the sync url', async () => {
      await service.connect('t1', 'salesforce', 'https://example.com/hook');

      expect(connections.save).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: true,
          syncUrl: 'https://example.com/hook',
          connectedAt: expect.any(Date),
        }),
      );
    });
  });

  describe('disconnect', () => {
    it('does nothing when there is no existing connection', async () => {
      await service.disconnect('t1', 'salesforce');

      expect(connections.save).not.toHaveBeenCalled();
    });

    it('disables an existing enabled connection', async () => {
      connections.findOne.mockResolvedValue({
        tenantId: 't1',
        integration: 'salesforce',
        enabled: true,
      });

      await service.disconnect('t1', 'salesforce');

      expect(connections.save).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
    });
  });

  describe('handleFeatureFlagDisabled', () => {
    it('disconnects every enabled connection for the tenant', async () => {
      connections.find.mockResolvedValue([
        { tenantId: 't1', integration: 'salesforce', enabled: true },
      ]);
      connections.findOne.mockResolvedValue({
        tenantId: 't1',
        integration: 'salesforce',
        enabled: true,
      });

      await service.handleFeatureFlagDisabled('t1');

      expect(connections.save).toHaveBeenCalledWith(
        expect.objectContaining({ integration: 'salesforce', enabled: false }),
      );
    });
  });

  describe('requestSync', () => {
    it('syncs every enabled connection and marks it completed', async () => {
      connections.find.mockResolvedValue([
        {
          tenantId: 't1',
          integration: 'salesforce',
          enabled: true,
          syncUrl: 'https://example.com/hook',
        },
      ]);
      global.fetch = jest.fn().mockResolvedValue({ ok: true }) as never;

      await service.requestSync('t1', 'c1');

      expect(circuitBreakerRegistry.wrap).toHaveBeenCalledWith('salesforce', expect.any(Function));
      expect(connections.save).toHaveBeenCalledWith(
        expect.objectContaining({ lastSyncStatus: 'completed' }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'integration.syncRequested',
        expect.objectContaining({ tenantId: 't1', integration: 'salesforce', contractId: 'c1' }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'integration.syncCompleted',
        expect.objectContaining({ tenantId: 't1', integration: 'salesforce', contractId: 'c1' }),
      );
    });

    it('marks the connection failed and dead-letters the sync when the push fails', async () => {
      connections.find.mockResolvedValue([
        {
          tenantId: 't1',
          integration: 'hubspot',
          enabled: true,
          syncUrl: 'https://example.com/hook',
        },
      ]);
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 }) as never;

      await service.requestSync('t1', 'c1');

      expect(connections.save).toHaveBeenCalledWith(
        expect.objectContaining({ lastSyncStatus: 'failed', lastSyncError: expect.any(String) }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'integration.syncFailed',
        expect.objectContaining({ tenantId: 't1', integration: 'hubspot' }),
      );
      expect(deadLetterQueueService.add).toHaveBeenCalledWith(
        'integration.syncRequested',
        expect.objectContaining({ tenantId: 't1', integration: 'hubspot', contractId: 'c1' }),
        expect.any(String),
      );
    });

    it('fails a connection with no syncUrl configured rather than calling fetch', async () => {
      connections.find.mockResolvedValue([
        { tenantId: 't1', integration: 'ms365', enabled: true, syncUrl: null },
      ]);
      global.fetch = jest.fn() as never;

      await service.requestSync('t1', 'c1');

      expect(global.fetch).not.toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'integration.syncFailed',
        expect.objectContaining({ integration: 'ms365' }),
      );
    });
  });

  describe('listConnections', () => {
    it('lists connections scoped to the tenant, ordered by integration', async () => {
      await service.listConnections('t1');

      expect(connections.find).toHaveBeenCalledWith({
        where: { tenantId: 't1' },
        order: { integration: 'ASC' },
      });
    });
  });
});
