import { ArgumentMetadata } from '@nestjs/common';
import { IsInt, IsString } from 'class-validator';
import { StrictValidationPipe, ValidationRejectedException } from './strict-validation.pipe';

class TestDto {
  @IsString()
  name: string;

  @IsInt()
  age: number;
}

describe('ValidationRejectedException', () => {
  it('maps ValidationError[] into a 400 body with property + constraints', () => {
    const exception = new ValidationRejectedException([
      { property: 'age', constraints: { isInt: 'age must be an integer number' } },
    ]);

    expect(exception.getStatus()).toBe(400);
    expect(exception.getResponse()).toEqual({
      statusCode: 400,
      message: 'Validation failed',
      errors: [{ property: 'age', constraints: { isInt: 'age must be an integer number' } }],
    });
  });
});

describe('StrictValidationPipe', () => {
  const metadata: ArgumentMetadata = { type: 'body', metatype: TestDto, data: undefined };
  const pipe = new StrictValidationPipe();

  it('transforms a valid plain payload into a DTO instance', async () => {
    const result = await pipe.transform({ name: 'Alice', age: 30 }, metadata);

    expect(result).toBeInstanceOf(TestDto);
    expect(result).toEqual({ name: 'Alice', age: 30 });
  });

  it('rejects a payload with a field of the wrong type', async () => {
    await expect(pipe.transform({ name: 123, age: 'not a number' }, metadata)).rejects.toThrow(
      ValidationRejectedException,
    );
  });

  it('rejects a payload carrying a property not declared on the DTO (forbidNonWhitelisted)', async () => {
    await expect(
      pipe.transform({ name: 'Alice', age: 30, role: 'admin' }, metadata),
    ).rejects.toThrow(ValidationRejectedException);
  });
});
