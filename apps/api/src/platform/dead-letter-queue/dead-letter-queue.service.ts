import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PLATFORM_EVENTS, PlatformEventPayloadMap } from '../events';
import { DeadLetterEntry } from './entities/dead-letter-entry.entity';

export interface DeadLetterRetryResult {
  originalEvent: string;
  payload: unknown;
}

@Injectable()
export class DeadLetterQueueService {
  constructor(
    @InjectRepository(DeadLetterEntry)
    private readonly deadLetterEntries: Repository<DeadLetterEntry>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async add(originalEvent: string, payload: unknown, failureReason: string): Promise<DeadLetterEntry> {
    const entry = await this.deadLetterEntries.save(
      this.deadLetterEntries.create({ originalEvent, payload, failureReason, retriedAt: null }),
    );

    this.eventEmitter.emit(
      PLATFORM_EVENTS.DEAD_LETTER_ADDED,
      { originalEvent, payload, failureReason } satisfies PlatformEventPayloadMap[typeof PLATFORM_EVENTS.DEAD_LETTER_ADDED],
    );

    return entry;
  }

  async list(filters?: { originalEvent?: string }): Promise<DeadLetterEntry[]> {
    return this.deadLetterEntries.find({
      where: filters?.originalEvent ? { originalEvent: filters.originalEvent } : {},
    });
  }

  async retry(entryId: string): Promise<DeadLetterRetryResult> {
    const entry = await this.deadLetterEntries.findOne({ where: { id: entryId } });

    if (!entry) {
      throw new NotFoundException('Dead letter entry not found');
    }

    entry.retriedAt = new Date();
    await this.deadLetterEntries.save(entry);

    return { originalEvent: entry.originalEvent, payload: entry.payload };
  }
}
