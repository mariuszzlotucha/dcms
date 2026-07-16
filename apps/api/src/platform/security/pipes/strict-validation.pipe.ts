import {
  BadRequestException,
  Injectable,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';

export class ValidationRejectedException extends BadRequestException {
  constructor(public readonly validationErrors: ValidationError[]) {
    super({
      statusCode: 400,
      message: 'Validation failed',
      errors: validationErrors.map((e) => ({
        property: e.property,
        constraints: e.constraints,
      })),
    });
  }
}

@Injectable()
export class StrictValidationPipe extends ValidationPipe {
  constructor() {
    super({
      whitelist: true, // strip properties without a decorator in the DTO
      forbidNonWhitelisted: true, // ...and reject the request if any are present
      transform: true, // plain payloads -> DTO class instances
      exceptionFactory: (errors) => new ValidationRejectedException(errors),
    });
  }
}
