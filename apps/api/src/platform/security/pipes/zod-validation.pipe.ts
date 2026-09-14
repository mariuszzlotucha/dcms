import { BadRequestException, PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

// The global StrictValidationPipe (APP_PIPE) is class-validator based and is
// a no-op for zod-inferred DTO types (no runtime class metadata for it to
// validate against — Nest's ValidationPipe skips metatype === Object). Apply
// this per-route via @UsePipes(new ZodValidationPipe(schema)) to actually
// validate bodies against a shared/contracts/*.schema.ts zod schema.
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Validation failed',
        errors: result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }

    return result.data;
  }
}
