import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

describe('ZodValidationPipe', () => {
  const schema = z.object({
    email: z.string().email(),
    age: z.number().int().min(0),
  });
  const pipe = new ZodValidationPipe(schema);

  it('returns the parsed data for a valid payload', () => {
    const result = pipe.transform({ email: 'a@example.com', age: 30 });

    expect(result).toEqual({ email: 'a@example.com', age: 30 });
  });

  it('strips unknown keys (zod default behavior, no passthrough)', () => {
    const result = pipe.transform({ email: 'a@example.com', age: 30, role: 'admin' });

    expect(result).toEqual({ email: 'a@example.com', age: 30 });
  });

  it('throws BadRequestException with mapped issues for an invalid payload', () => {
    try {
      pipe.transform({ email: 'not-an-email', age: -1 });
      throw new Error('expected transform to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const response = (error as BadRequestException).getResponse() as {
        statusCode: number;
        message: string;
        errors: { path: string; message: string }[];
      };
      expect(response.statusCode).toBe(400);
      expect(response.errors.map((e) => e.path)).toEqual(expect.arrayContaining(['email', 'age']));
    }
  });
});
