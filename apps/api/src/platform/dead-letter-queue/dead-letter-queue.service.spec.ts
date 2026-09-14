import { NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PLATFORM_EVENTS } from '../events';
import { DeadLetterQueueService } from './dead-letter-queue.service';
import { DeadLetterEntry } from './entities/dead-letter-entry.entity';

describe('DeadLetterQueueService', () => {
  let deadLetterEntries: { save: jest.Mock; create: jest.Mock; find: jest.Mock; findOne: jest.Mock };
  let eventEmitter: { emit: jest.Mock };
  let service: DeadLetterQueueService;

  beforeEach(() => {
    deadLetterEntries = {
      save: jest.fn(async (data) => ({ id: 'd1', ...data }) as DeadLetterEntry),
      create: jest.fn((data) => data),
      find: jest.fn(),
      findOne: jest.fn(),
    };
    eventEmitter = { emit: jest.fn() };

    service = new DeadLetterQueueService(deadLetterEntries as never, eventEmitter as unknown as EventEmitter2);
  });

  describe('add', () => {
    it('persists the entry with retriedAt unset and emits DEAD_LETTER_ADDED', async () => {
      await service.add('webhooks', { subscriptionId: 's1' }, 'delivery failed after 3 attempts');

      expect(deadLetterEntries.create).toHaveBeenCalledWith({
        originalEvent: 'webhooks',
        payload: { subscriptionId: 's1' },
        failureReason: 'delivery failed after 3 attempts',
        retriedAt: null,
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith(PLATFORM_EVENTS.DEAD_LETTER_ADDED, {
        originalEvent: 'webhooks',
        payload: { subscriptionId: 's1' },
        failureReason: 'delivery failed after 3 attempts',
      });
    });
  });

  describe('list', () => {
    it('lists all entries when no filter is given', async () => {
      deadLetterEntries.find.mockResolvedValue([]);

      await service.list();

      expect(deadLetterEntries.find).toHaveBeenCalledWith({ where: {} });
    });

    it('filters by originalEvent when given', async () => {
      deadLetterEntries.find.mockResolvedValue([]);

      await service.list({ originalEvent: 'webhooks' });

      expect(deadLetterEntries.find).toHaveBeenCalledWith({ where: { originalEvent: 'webhooks' } });
    });
  });

  describe('retry', () => {
    it('throws NotFoundException for an unknown entry', async () => {
      deadLetterEntries.findOne.mockResolvedValue(null);

      await expect(service.retry('missing')).rejects.toThrow(NotFoundException);
    });

    it('marks the entry retried and returns the original event and payload for replay', async () => {
      deadLetterEntries.findOne.mockResolvedValue({
        id: 'd1',
        originalEvent: 'webhooks',
        payload: { subscriptionId: 's1' },
        retriedAt: null,
      } as DeadLetterEntry);

      const result = await service.retry('d1');

      expect(deadLetterEntries.save).toHaveBeenCalledWith(expect.objectContaining({ retriedAt: expect.any(Date) }));
      expect(result).toEqual({ originalEvent: 'webhooks', payload: { subscriptionId: 's1' } });
    });
  });
});
