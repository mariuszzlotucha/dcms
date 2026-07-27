import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { IdempotencyRecord } from './entities/idempotency-record.entity';
import { IDEMPOTENCY_MODULE_CONFIG, IdempotencyModuleConfig } from './idempotency.config';

const POSTGRES_UNIQUE_VIOLATION = '23505';

@Injectable()
export class IdempotencyService {
  constructor(
    @InjectRepository(IdempotencyRecord)
    private readonly records: Repository<IdempotencyRecord>,
    @Inject(IDEMPOTENCY_MODULE_CONFIG)
    private readonly config: IdempotencyModuleConfig,
  ) {}

  async findValidRecord(idempotencyKey: string): Promise<IdempotencyRecord | null> {
    const existing = await this.records.findOne({ where: { idempotencyKey } });

    if (existing && existing.createdAt > this.cutoff()) {
      return existing;
    }

    return null;
  }

  async persist(
    idempotencyKey: string,
    requestPath: string,
    responseStatus: number,
    responseBody: unknown,
  ): Promise<void> {
    try {
      await this.records.save(
        this.records.create({ idempotencyKey, requestPath, responseStatus, responseBody }),
      );
    } catch (error) {
      if ((error as { code?: string }).code === POSTGRES_UNIQUE_VIOLATION) {
        await this.records.findOne({ where: { idempotencyKey } });
        return;
      }
      throw error;
    }
  }

  async pruneExpired(): Promise<number> {
    const result = await this.records.delete({ createdAt: LessThan(this.cutoff()) });
    return result.affected ?? 0;
  }

  private cutoff(): Date {
    return new Date(Date.now() - this.config.recordTtlHours * 60 * 60 * 1000);
  }
}
