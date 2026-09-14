import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConsentService } from '@platform/consent/consent.service';
import { FileStorageService } from '@platform/file-storage/file-storage.service';
import { PLATFORM_EVENTS } from '../events';
import { DataRetentionService } from './data-retention.service';
import { DataRetentionModuleConfig, UserAccountQueries } from './data-retention.config';

describe('DataRetentionService', () => {
  let consentService: {
    findRevokedBefore: jest.Mock;
    deleteRecords: jest.Mock;
    deleteAllForUser: jest.Mock;
  };
  let fileStorageService: {
    listFiles: jest.Mock;
    listAllFiles: jest.Mock;
    listFilesByUploader: jest.Mock;
    deleteFile: jest.Mock;
  };
  let userAccountQueries: jest.Mocked<UserAccountQueries>;
  let eventEmitter: { emit: jest.Mock };
  let service: DataRetentionService;

  const config: DataRetentionModuleConfig = {
    inactiveAccountDeletionDays: 365,
    revokedConsentPurgeDays: 90,
  };

  beforeEach(() => {
    consentService = {
      findRevokedBefore: jest.fn(),
      deleteRecords: jest.fn(),
      deleteAllForUser: jest.fn(),
    };
    fileStorageService = {
      listFiles: jest.fn(),
      listAllFiles: jest.fn(),
      listFilesByUploader: jest.fn(),
      deleteFile: jest.fn(),
    };
    userAccountQueries = {
      findUserIdsInactiveSince: jest.fn(),
      userExists: jest.fn(),
      deleteUser: jest.fn(),
    };
    eventEmitter = { emit: jest.fn() };

    service = new DataRetentionService(
      config,
      consentService as unknown as ConsentService,
      fileStorageService as unknown as FileStorageService,
      userAccountQueries,
      eventEmitter as unknown as EventEmitter2,
    );
  });

  describe('purgeRevokedConsentData', () => {
    it('passes a cutoff based on the configured retention window and the optional tenantId through', async () => {
      consentService.findRevokedBefore.mockResolvedValue([]);

      await service.purgeRevokedConsentData('t1');

      expect(consentService.findRevokedBefore).toHaveBeenCalledWith(expect.any(Date), 't1');
    });

    it('deletes and counts each distinct user/tenant/type group once', async () => {
      consentService.findRevokedBefore.mockResolvedValue([
        { userId: 'u1', tenantId: 't1', consentType: 'marketing_emails' },
      ]);
      consentService.deleteRecords.mockResolvedValue([{ id: 'c1', tenantId: 't1' }]);

      const count = await service.purgeRevokedConsentData();

      expect(count).toBe(1);
      expect(eventEmitter.emit).toHaveBeenCalledWith(PLATFORM_EVENTS.DATA_RETENTION_PURGED, {
        tenantId: 't1',
        resourceType: 'consent_record',
        resourceId: 'c1',
      });
    });

    it('deduplicates multiple revoked rows that belong to the same user/tenant/type group', async () => {
      consentService.findRevokedBefore.mockResolvedValue([
        { userId: 'u1', tenantId: 't1', consentType: 'marketing_emails' },
        { userId: 'u1', tenantId: 't1', consentType: 'marketing_emails' },
      ]);
      consentService.deleteRecords.mockResolvedValue([{ id: 'c1', tenantId: 't1' }]);

      await service.purgeRevokedConsentData();

      expect(consentService.deleteRecords).toHaveBeenCalledTimes(1);
    });
  });

  describe('purgeOrphanedFiles', () => {
    it('scopes to a tenant via listFiles when a tenantId is given', async () => {
      fileStorageService.listFiles.mockResolvedValue([]);

      await service.purgeOrphanedFiles('t1');

      expect(fileStorageService.listFiles).toHaveBeenCalledWith('t1');
      expect(fileStorageService.listAllFiles).not.toHaveBeenCalled();
    });

    it('sweeps every tenant via listAllFiles when no tenantId is given', async () => {
      fileStorageService.listAllFiles.mockResolvedValue([]);

      await service.purgeOrphanedFiles();

      expect(fileStorageService.listAllFiles).toHaveBeenCalled();
      expect(fileStorageService.listFiles).not.toHaveBeenCalled();
    });

    it('skips files whose uploader still exists', async () => {
      fileStorageService.listAllFiles.mockResolvedValue([
        { id: 'f1', tenantId: 't1', uploadedBy: 'u1' },
      ]);
      userAccountQueries.userExists.mockResolvedValue(true);

      const count = await service.purgeOrphanedFiles();

      expect(count).toBe(0);
      expect(fileStorageService.deleteFile).not.toHaveBeenCalled();
    });

    it('deletes and counts files whose uploader no longer exists', async () => {
      fileStorageService.listAllFiles.mockResolvedValue([
        { id: 'f1', tenantId: 't1', uploadedBy: 'ghost' },
      ]);
      userAccountQueries.userExists.mockResolvedValue(false);

      const count = await service.purgeOrphanedFiles();

      expect(count).toBe(1);
      expect(fileStorageService.deleteFile).toHaveBeenCalledWith('t1', 'f1');
      expect(eventEmitter.emit).toHaveBeenCalledWith(PLATFORM_EVENTS.DATA_RETENTION_PURGED, {
        tenantId: 't1',
        resourceType: 'file',
        resourceId: 'f1',
      });
    });
  });

  describe('purgeInactiveAccounts', () => {
    it('cascades to files and consent records before deleting the account, emitting one event per resource', async () => {
      userAccountQueries.findUserIdsInactiveSince.mockResolvedValue(['u1']);
      fileStorageService.listFilesByUploader.mockResolvedValue([{ id: 'f1', tenantId: 't1' }]);
      consentService.deleteAllForUser.mockResolvedValue([{ id: 'c1', tenantId: 't1' }]);

      const count = await service.purgeInactiveAccounts();

      expect(count).toBe(1);
      expect(fileStorageService.deleteFile).toHaveBeenCalledWith('t1', 'f1');
      expect(userAccountQueries.deleteUser).toHaveBeenCalledWith('u1');
      expect(eventEmitter.emit).toHaveBeenCalledWith(PLATFORM_EVENTS.DATA_RETENTION_PURGED, {
        tenantId: 't1',
        resourceType: 'file',
        resourceId: 'f1',
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith(PLATFORM_EVENTS.DATA_RETENTION_PURGED, {
        tenantId: 't1',
        resourceType: 'consent_record',
        resourceId: 'c1',
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith(PLATFORM_EVENTS.DATA_RETENTION_PURGED, {
        tenantId: '',
        resourceType: 'user',
        resourceId: 'u1',
      });
    });

    it('returns 0 and deletes nothing when there are no inactive accounts', async () => {
      userAccountQueries.findUserIdsInactiveSince.mockResolvedValue([]);

      const count = await service.purgeInactiveAccounts();

      expect(count).toBe(0);
      expect(userAccountQueries.deleteUser).not.toHaveBeenCalled();
    });

    it('processes every inactive account found', async () => {
      userAccountQueries.findUserIdsInactiveSince.mockResolvedValue(['u1', 'u2']);
      fileStorageService.listFilesByUploader.mockResolvedValue([]);
      consentService.deleteAllForUser.mockResolvedValue([]);

      const count = await service.purgeInactiveAccounts();

      expect(count).toBe(2);
      expect(userAccountQueries.deleteUser).toHaveBeenCalledWith('u1');
      expect(userAccountQueries.deleteUser).toHaveBeenCalledWith('u2');
    });
  });
});
