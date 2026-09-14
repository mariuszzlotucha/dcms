import { EventEmitter2 } from '@nestjs/event-emitter';
import { PLATFORM_EVENTS } from '../events';
import { ConsentService } from './consent.service';
import { ConsentModuleConfig } from './consent.config';
import { ConsentRecord } from './entities/consent-record.entity';

describe('ConsentService', () => {
  let consentRecords: {
    save: jest.Mock;
    create: jest.Mock;
    find: jest.Mock;
    remove: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let eventEmitter: { emit: jest.Mock };
  let service: ConsentService;
  let qb: { where: jest.Mock; andWhere: jest.Mock; getMany: jest.Mock };

  const config: ConsentModuleConfig = {
    currentVersions: { terms_of_service: '2026-01-15', marketing_emails: '2026-01-15' },
  };

  beforeEach(() => {
    qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
    };
    consentRecords = {
      save: jest.fn(async (data) => ({ id: 'c1', ...data }) as ConsentRecord),
      create: jest.fn((data) => data),
      find: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    };
    eventEmitter = { emit: jest.fn() };

    service = new ConsentService(consentRecords as never, config, eventEmitter as unknown as EventEmitter2);
  });

  describe('grant', () => {
    it('stamps the record with the current version for that consent type and emits CONSENT_GRANTED', async () => {
      await service.grant('u1', 't1', 'terms_of_service');

      expect(consentRecords.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'u1', tenantId: 't1', consentType: 'terms_of_service', version: '2026-01-15', revokedAt: null }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(PLATFORM_EVENTS.CONSENT_GRANTED, {
        userId: 'u1',
        tenantId: 't1',
        consentType: 'terms_of_service',
        version: '2026-01-15',
      });
    });
  });

  describe('revoke', () => {
    it('creates a revocation record and emits CONSENT_REVOKED', async () => {
      await service.revoke('u1', 't1', 'marketing_emails');

      expect(consentRecords.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'u1', tenantId: 't1', consentType: 'marketing_emails', grantedAt: null, revokedAt: expect.any(Date) }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(PLATFORM_EVENTS.CONSENT_REVOKED, {
        tenantId: 't1',
        userId: 'u1',
        consentType: 'marketing_emails',
      });
    });
  });

  describe('getStatus', () => {
    it('returns never_granted when there is no record at all', async () => {
      consentRecords.find.mockResolvedValue([]);

      await expect(service.getStatus('u1', 't1', 'terms_of_service')).resolves.toEqual({
        consentType: 'terms_of_service',
        state: 'never_granted',
        version: null,
        grantedAt: null,
        revokedAt: null,
      });
    });

    it('returns current when the most recent record matches the current version and is not revoked', async () => {
      consentRecords.find.mockResolvedValue([
        { grantedAt: new Date('2026-01-16'), revokedAt: null, version: '2026-01-15' },
      ]);

      const status = await service.getStatus('u1', 't1', 'terms_of_service');

      expect(status.state).toBe('current');
    });

    it('returns outdated when the most recent grant predates a version bump', async () => {
      consentRecords.find.mockResolvedValue([
        { grantedAt: new Date('2025-06-01'), revokedAt: null, version: '2025-06-01' },
      ]);

      const status = await service.getStatus('u1', 't1', 'terms_of_service');

      expect(status.state).toBe('outdated');
    });

    it('returns revoked when the most recent record (by timestamp) is a revocation', async () => {
      consentRecords.find.mockResolvedValue([
        { grantedAt: new Date('2026-01-01'), revokedAt: null, version: '2026-01-15' },
        { grantedAt: null, revokedAt: new Date('2026-02-01'), version: '2026-01-15' },
      ]);

      const status = await service.getStatus('u1', 't1', 'terms_of_service');

      expect(status.state).toBe('revoked');
      expect(status.grantedAt).toBeNull();
    });

    it('treats a later grant as current again after an earlier revocation', async () => {
      consentRecords.find.mockResolvedValue([
        { grantedAt: null, revokedAt: new Date('2026-01-01'), version: '2026-01-15' },
        { grantedAt: new Date('2026-02-01'), revokedAt: null, version: '2026-01-15' },
      ]);

      const status = await service.getStatus('u1', 't1', 'terms_of_service');

      expect(status.state).toBe('current');
    });
  });

  describe('getAllStatuses', () => {
    it('returns a status for every configured consent type', async () => {
      consentRecords.find.mockResolvedValue([]);

      const statuses = await service.getAllStatuses('u1', 't1');

      expect(statuses.map((s) => s.consentType)).toEqual(
        expect.arrayContaining(['terms_of_service', 'marketing_emails']),
      );
      expect(statuses).toHaveLength(2);
    });
  });

  describe('findRevokedBefore', () => {
    it('filters by cutoff without a tenant filter when none is given', async () => {
      qb.getMany.mockResolvedValue([]);

      await service.findRevokedBefore(new Date('2026-01-01'));

      expect(qb.andWhere).toHaveBeenCalledTimes(1);
      expect(qb.andWhere).toHaveBeenCalledWith('record.revokedAt < :cutoff', { cutoff: new Date('2026-01-01') });
    });

    it('adds a tenant filter when a tenantId is given', async () => {
      qb.getMany.mockResolvedValue([]);

      await service.findRevokedBefore(new Date('2026-01-01'), 't1');

      expect(qb.andWhere).toHaveBeenCalledTimes(2);
      expect(qb.andWhere).toHaveBeenCalledWith('record.tenantId = :tenantId', { tenantId: 't1' });
    });
  });

  describe('deleteRecords', () => {
    it('returns an empty array and skips remove() when there is nothing to delete', async () => {
      consentRecords.find.mockResolvedValue([]);

      await expect(service.deleteRecords('u1', 't1', 'terms_of_service')).resolves.toEqual([]);
      expect(consentRecords.remove).not.toHaveBeenCalled();
    });

    it('removes and returns the matching records', async () => {
      const records = [{ id: 'c1' }] as ConsentRecord[];
      consentRecords.find.mockResolvedValue(records);

      await expect(service.deleteRecords('u1', 't1', 'terms_of_service')).resolves.toEqual(records);
      expect(consentRecords.remove).toHaveBeenCalledWith(records);
    });
  });

  describe('deleteAllForUser', () => {
    it('returns an empty array when the user has no consent records', async () => {
      consentRecords.find.mockResolvedValue([]);

      await expect(service.deleteAllForUser('u1')).resolves.toEqual([]);
      expect(consentRecords.remove).not.toHaveBeenCalled();
    });

    it('removes every record for the user regardless of tenant or type', async () => {
      const records = [{ id: 'c1' }, { id: 'c2' }] as ConsentRecord[];
      consentRecords.find.mockResolvedValue(records);

      await expect(service.deleteAllForUser('u1')).resolves.toEqual(records);
      expect(consentRecords.find).toHaveBeenCalledWith({ where: { userId: 'u1' } });
      expect(consentRecords.remove).toHaveBeenCalledWith(records);
    });
  });
});
