import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConsentService } from '@platform/consent/consent.service';
import { FileStorageService } from '@platform/file-storage/file-storage.service';
import { PLATFORM_EVENTS, PlatformEventPayloadMap } from '../events';
import { DATA_RETENTION_MODULE_CONFIG, DataRetentionModuleConfig } from './data-retention.config';
import { USER_ACCOUNT_QUERIES, UserAccountQueries } from './data-retention.module';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class DataRetentionService {
  constructor(
    @Inject(DATA_RETENTION_MODULE_CONFIG)
    private readonly config: DataRetentionModuleConfig,
    private readonly consentService: ConsentService,
    private readonly fileStorageService: FileStorageService,
    @Inject(USER_ACCOUNT_QUERIES)
    private readonly userAccountQueries: UserAccountQueries,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async purgeRevokedConsentData(tenantId?: string): Promise<number> {
    const cutoff = this.daysAgo(this.config.revokedConsentPurgeDays);
    const expired = await this.consentService.findRevokedBefore(cutoff, tenantId);

    const seenGroups = new Set<string>();
    let purgedCount = 0;

    for (const record of expired) {
      const groupKey = `${record.userId}:${record.tenantId}:${record.consentType}`;
      if (seenGroups.has(groupKey)) {
        continue;
      }
      seenGroups.add(groupKey);

      const deleted = await this.consentService.deleteRecords(record.userId, record.tenantId, record.consentType);

      for (const deletedRecord of deleted) {
        this.emitPurged('consent_record', deletedRecord.id, deletedRecord.tenantId);
        purgedCount++;
      }
    }

    return purgedCount;
  }

  // Placeholder eligibility rule: a file is "orphaned" only if its uploader's
  // account no longer exists. This will need revisiting once domain/contracts
  // exists and files can be tied to a contract's lifecycle instead.
  async purgeOrphanedFiles(tenantId?: string): Promise<number> {
    const files = await this.fileStorageService.listFiles(tenantId);
    let purgedCount = 0;

    for (const file of files) {
      const uploaderExists = await this.userAccountQueries.userExists(file.uploadedBy);
      if (uploaderExists) {
        continue;
      }

      await this.fileStorageService.deleteFile(file.tenantId, file.id);
      this.emitPurged('file', file.id, file.tenantId);
      purgedCount++;
    }

    return purgedCount;
  }

  // Cascades to FileRecord (via file-storage) and ConsentRecord (via consent).
  // Does NOT cascade to RoleAssignment (rbac) — rbac is not a declared
  // dependency of this module; those rows are left as a known, acknowledged
  // gap rather than silently reached into.
  async purgeInactiveAccounts(): Promise<number> {
    const cutoff = this.daysAgo(this.config.inactiveAccountDeletionDays);
    const inactiveUserIds = await this.userAccountQueries.findUserIdsInactiveSince(cutoff);
    let purgedCount = 0;

    for (const userId of inactiveUserIds) {
      const files = await this.fileStorageService.listFilesByUploader(userId);
      for (const file of files) {
        await this.fileStorageService.deleteFile(file.tenantId, file.id);
        this.emitPurged('file', file.id, file.tenantId);
      }

      const consentRecords = await this.consentService.deleteAllForUser(userId);
      for (const record of consentRecords) {
        this.emitPurged('consent_record', record.id, record.tenantId);
      }

      await this.userAccountQueries.deleteUser(userId);
      this.emitPurged('user', userId, null);
      purgedCount++;
    }

    return purgedCount;
  }

  private emitPurged(resourceType: string, resourceId: string, tenantId: string | null): void {
    this.eventEmitter.emit(
      PLATFORM_EVENTS.DATA_RETENTION_PURGED,
      { tenantId: tenantId ?? '', resourceType, resourceId } satisfies PlatformEventPayloadMap[typeof PLATFORM_EVENTS.DATA_RETENTION_PURGED],
    );
  }

  private daysAgo(days: number): Date {
    return new Date(Date.now() - days * MS_PER_DAY);
  }
}
