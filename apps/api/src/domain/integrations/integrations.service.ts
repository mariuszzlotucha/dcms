import { ForbiddenException, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CircuitBreakerRegistry } from '@platform/circuit-breaker/registry/circuit-breaker.registry';
import { DeadLetterQueueService } from '@platform/dead-letter-queue/dead-letter-queue.service';
import { FeatureFlagsService } from '@platform/feature-flags/feature-flags.service';
import { EVENTS, EventPayloadMap } from '@';
import { integrationTypeSchema, type IntegrationType } from '@contracts/integrations.schema';
import { IntegrationConnection } from './entities/integration-connection.entity';

// architecture doc 1.9: "featureFlag.toggled — controls integration
// availability as a premium/enterprise feature."
export const INTEGRATIONS_FLAG = 'integrations';

const ALL_INTEGRATIONS = integrationTypeSchema.options;

@Injectable()
export class IntegrationsService {
  constructor(
    @InjectRepository(IntegrationConnection)
    private readonly connections: Repository<IntegrationConnection>,
    private readonly circuitBreakerRegistry: CircuitBreakerRegistry,
    private readonly deadLetterQueueService: DeadLetterQueueService,
    private readonly featureFlagsService: FeatureFlagsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // architecture doc 1.9: "tenant.created — initializes an empty integration
  // configuration for a new tenant." Idempotent (mirrors templates'
  // seedStarterTemplates) — a replayed tenant.created event must not
  // clobber connections a tenant already configured.
  async initializeTenantConfig(tenantId: string): Promise<void> {
    const existing = await this.connections.find({ where: { tenantId } });
    const existingTypes = new Set(existing.map((connection) => connection.integration));
    const missing = ALL_INTEGRATIONS.filter((integration) => !existingTypes.has(integration));

    if (missing.length === 0) {
      return;
    }

    await this.connections.save(
      missing.map((integration) => this.blankConnection(tenantId, integration)),
    );
  }

  async connect(
    tenantId: string,
    integration: IntegrationType,
    syncUrl: string,
  ): Promise<IntegrationConnection> {
    if (!(await this.featureFlagsService.isEnabled(tenantId, INTEGRATIONS_FLAG))) {
      throw new ForbiddenException('Integrations are not enabled for this tenant');
    }

    const connection =
      (await this.connections.findOne({ where: { tenantId, integration } })) ??
      this.blankConnection(tenantId, integration);

    connection.enabled = true;
    connection.syncUrl = syncUrl;
    connection.connectedAt = new Date();
    return this.connections.save(connection);
  }

  async disconnect(tenantId: string, integration: IntegrationType): Promise<void> {
    const connection = await this.connections.findOne({ where: { tenantId, integration } });

    if (!connection || !connection.enabled) {
      return;
    }

    connection.enabled = false;
    await this.connections.save(connection);
  }

  // Turning the flag off disconnects every connection the tenant had —
  // turning it back on does NOT auto-reconnect, since that requires the
  // tenant to re-supply a syncUrl via connect().
  async handleFeatureFlagDisabled(tenantId: string): Promise<void> {
    const enabled = await this.connections.find({ where: { tenantId, enabled: true } });
    await Promise.all(
      enabled.map((connection) => this.disconnect(tenantId, connection.integration)),
    );
  }

  async requestSync(tenantId: string, contractId: string): Promise<void> {
    const enabled = await this.connections.find({ where: { tenantId, enabled: true } });
    await Promise.all(enabled.map((connection) => this.sync(connection, contractId)));
  }

  async listConnections(tenantId: string): Promise<IntegrationConnection[]> {
    return this.connections.find({ where: { tenantId }, order: { integration: 'ASC' } });
  }

  private blankConnection(tenantId: string, integration: IntegrationType): IntegrationConnection {
    return this.connections.create({
      tenantId,
      integration,
      enabled: false,
      syncUrl: null,
      connectedAt: null,
      lastSyncedAt: null,
      lastSyncStatus: 'idle',
      lastSyncError: null,
    });
  }

  private async sync(connection: IntegrationConnection, contractId: string): Promise<void> {
    this.eventEmitter.emit(EVENTS.INTEGRATION_SYNC_REQUESTED, {
      tenantId: connection.tenantId,
      integration: connection.integration,
      contractId,
    } satisfies EventPayloadMap[typeof EVENTS.INTEGRATION_SYNC_REQUESTED]);

    connection.lastSyncStatus = 'syncing';
    await this.connections.save(connection);

    try {
      await this.circuitBreakerRegistry.wrap(connection.integration, () =>
        this.pushToProvider(connection, contractId),
      );

      connection.lastSyncStatus = 'completed';
      connection.lastSyncedAt = new Date();
      connection.lastSyncError = null;
      await this.connections.save(connection);

      this.eventEmitter.emit(EVENTS.INTEGRATION_SYNC_COMPLETED, {
        tenantId: connection.tenantId,
        integration: connection.integration,
        contractId,
      } satisfies EventPayloadMap[typeof EVENTS.INTEGRATION_SYNC_COMPLETED]);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown sync failure';

      connection.lastSyncStatus = 'failed';
      connection.lastSyncError = reason;
      await this.connections.save(connection);

      this.eventEmitter.emit(EVENTS.INTEGRATION_SYNC_FAILED, {
        tenantId: connection.tenantId,
        integration: connection.integration,
        reason,
      } satisfies EventPayloadMap[typeof EVENTS.INTEGRATION_SYNC_FAILED]);

      await this.deadLetterQueueService.add(
        EVENTS.INTEGRATION_SYNC_REQUESTED,
        { tenantId: connection.tenantId, integration: connection.integration, contractId },
        reason,
      );
    }
  }

  // Thin adapter (architecture doc 1.9: does NOT store integration secrets
  // itself, does NOT implement retry logic itself — that's circuit-breaker/
  // dead-letter-queue above). None of the four providers has an OAuth grant
  // flow built yet, so connect() hands DCMS a plain relay URL (e.g. a
  // Zapier/Make.com webhook, or a tenant-owned endpoint) rather than a
  // provider credential to fetch via SecretsService.
  private async pushToProvider(
    connection: IntegrationConnection,
    contractId: string,
  ): Promise<void> {
    if (!connection.syncUrl) {
      throw new Error(`No syncUrl configured for ${connection.integration}`);
    }

    const response = await fetch(connection.syncUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: connection.tenantId,
        integration: connection.integration,
        contractId,
      }),
    });

    if (!response.ok) {
      throw new Error(`Sync to ${connection.integration} failed with status ${response.status}`);
    }
  }
}
