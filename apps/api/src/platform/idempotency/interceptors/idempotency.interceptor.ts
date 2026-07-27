import { CallHandler, ExecutionContext, Inject, Injectable, NestInterceptor } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Observable, of, tap } from 'rxjs';
import { Repository } from 'typeorm';
import { IdempotencyRecord } from '../entities/idempotency-record.entity';
import { IDEMPOTENCY_MODULE_CONFIG, IdempotencyModuleConfig } from '../idempotency.config';

const POSTGRES_UNIQUE_VIOLATION = '23505';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    @InjectRepository(IdempotencyRecord)
    private readonly records: Repository<IdempotencyRecord>,
    @Inject(IDEMPOTENCY_MODULE_CONFIG)
    private readonly config: IdempotencyModuleConfig,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest();
    const idempotencyKey = request.headers['idempotency-key'];

    if (!idempotencyKey || Array.isArray(idempotencyKey)) {
      return next.handle();
    }

    const cutoff = new Date(Date.now() - this.config.recordTtlHours * 60 * 60 * 1000);
    const existing = await this.records.findOne({ where: { idempotencyKey } });

    if (existing && existing.createdAt > cutoff) {
      const response = context.switchToHttp().getResponse();
      response.status(existing.responseStatus);
      return of(existing.responseBody);
    }

    return next.handle().pipe(
      tap((responseBody: unknown) => {
        const response = context.switchToHttp().getResponse();
        void this.persist(idempotencyKey, request.path, response.statusCode, responseBody);
      }),
    );
  }

  private async persist(
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
}
