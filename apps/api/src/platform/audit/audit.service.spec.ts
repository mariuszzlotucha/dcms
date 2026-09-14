import { AuditService } from './audit.module';
import { AuditEntry } from './entities/audit-entry.entity';

describe('AuditService', () => {
  let auditEntries: { save: jest.Mock; create: jest.Mock; createQueryBuilder: jest.Mock };
  let service: AuditService;
  let qb: {
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    skip: jest.Mock;
    take: jest.Mock;
    getManyAndCount: jest.Mock;
  };

  beforeEach(() => {
    qb = {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    auditEntries = {
      save: jest.fn(async (data) => ({ id: 'a1', ...data }) as AuditEntry),
      create: jest.fn((data) => data),
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    };
    service = new AuditService(auditEntries as never);
  });

  describe('record', () => {
    it('stamps the entry with a timestamp and saves it', async () => {
      await service.record('contract.created', 'u1', 't1', { id: 'c1' });

      expect(auditEntries.create).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: 'contract.created',
          actorId: 'u1',
          tenantId: 't1',
          payload: { id: 'c1' },
          timestamp: expect.any(Date),
        }),
      );
    });
  });

  describe('query', () => {
    it('applies no filters beyond ordering/pagination when none are given', async () => {
      await service.query({});

      expect(qb.andWhere).not.toHaveBeenCalled();
      expect(qb.orderBy).toHaveBeenCalledWith('entry.timestamp', 'DESC');
      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(qb.take).toHaveBeenCalledWith(50);
    });

    it('applies every provided filter', async () => {
      const from = new Date('2026-01-01');
      const to = new Date('2026-02-01');

      await service.query({ tenantId: 't1', eventName: 'contract.created', from, to });

      expect(qb.andWhere).toHaveBeenCalledWith('entry.tenantId = :tenantId', { tenantId: 't1' });
      expect(qb.andWhere).toHaveBeenCalledWith('entry.eventName = :eventName', {
        eventName: 'contract.created',
      });
      expect(qb.andWhere).toHaveBeenCalledWith('entry.timestamp >= :from', { from });
      expect(qb.andWhere).toHaveBeenCalledWith('entry.timestamp <= :to', { to });
    });

    it('computes skip from the requested page and pageSize', async () => {
      await service.query({ page: 3, pageSize: 20 });

      expect(qb.skip).toHaveBeenCalledWith(40);
      expect(qb.take).toHaveBeenCalledWith(20);
    });

    it('returns the entries and total count from the query', async () => {
      const entries = [{ id: 'a1' }] as AuditEntry[];
      qb.getManyAndCount.mockResolvedValue([entries, 1]);

      await expect(service.query({})).resolves.toEqual({ entries, total: 1 });
    });
  });
});
