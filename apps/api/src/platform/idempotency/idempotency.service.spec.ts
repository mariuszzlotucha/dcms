import { IdempotencyService } from './idempotency.service';
import { IdempotencyModuleConfig } from './idempotency.config';
import { IdempotencyRecord } from './entities/idempotency-record.entity';

describe('IdempotencyService', () => {
  let records: { findOne: jest.Mock; save: jest.Mock; create: jest.Mock; delete: jest.Mock };
  let service: IdempotencyService;

  const config: IdempotencyModuleConfig = { recordTtlHours: 24 };

  beforeEach(() => {
    records = {
      findOne: jest.fn(),
      save: jest.fn(async (data) => ({ id: 'r1', ...data }) as IdempotencyRecord),
      create: jest.fn((data) => data),
      delete: jest.fn(),
    };
    service = new IdempotencyService(records as never, config);
  });

  describe('findValidRecord', () => {
    it('returns null when no record exists', async () => {
      records.findOne.mockResolvedValue(null);

      await expect(service.findValidRecord('key-1')).resolves.toBeNull();
    });

    it('returns the record when it is within the TTL window', async () => {
      const record = { idempotencyKey: 'key-1', createdAt: new Date() } as IdempotencyRecord;
      records.findOne.mockResolvedValue(record);

      await expect(service.findValidRecord('key-1')).resolves.toBe(record);
    });

    it('returns null when the record has expired (older than recordTtlHours)', async () => {
      const record = {
        idempotencyKey: 'key-1',
        createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
      } as IdempotencyRecord;
      records.findOne.mockResolvedValue(record);

      await expect(service.findValidRecord('key-1')).resolves.toBeNull();
    });
  });

  describe('persist', () => {
    it('saves a new record with the request path, status, and body', async () => {
      await service.persist('key-1', '/api/contracts', 201, { id: 'c1' });

      expect(records.create).toHaveBeenCalledWith({
        idempotencyKey: 'key-1',
        requestPath: '/api/contracts',
        responseStatus: 201,
        responseBody: { id: 'c1' },
      });
    });

    it('silently ignores a concurrent duplicate insert (unique violation)', async () => {
      records.save.mockRejectedValueOnce({ code: '23505' });
      records.findOne.mockResolvedValue({ idempotencyKey: 'key-1' } as IdempotencyRecord);

      await expect(service.persist('key-1', '/api/contracts', 201, {})).resolves.toBeUndefined();
    });

    it('rethrows any other error', async () => {
      records.save.mockRejectedValueOnce(new Error('connection lost'));

      await expect(service.persist('key-1', '/api/contracts', 201, {})).rejects.toThrow('connection lost');
    });
  });

  describe('pruneExpired', () => {
    it('deletes records older than the configured TTL and returns the affected count', async () => {
      records.delete.mockResolvedValue({ affected: 3 });

      await expect(service.pruneExpired()).resolves.toBe(3);
    });

    it('returns 0 when affected is undefined', async () => {
      records.delete.mockResolvedValue({ affected: undefined });

      await expect(service.pruneExpired()).resolves.toBe(0);
    });
  });
});
