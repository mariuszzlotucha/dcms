import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, of, tap } from 'rxjs';
import { IdempotencyService } from '../idempotency.service';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly idempotencyService: IdempotencyService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest();
    const idempotencyKey = request.headers['idempotency-key'];

    if (!idempotencyKey || Array.isArray(idempotencyKey)) {
      return next.handle();
    }

    const existing = await this.idempotencyService.findValidRecord(idempotencyKey);

    if (existing) {
      const response = context.switchToHttp().getResponse();
      response.status(existing.responseStatus);
      return of(existing.responseBody);
    }

    return next.handle().pipe(
      tap((responseBody: unknown) => {
        const response = context.switchToHttp().getResponse();
        void this.idempotencyService.persist(idempotencyKey, request.path, response.statusCode, responseBody);
      }),
    );
  }
}
