import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Request, Response } from 'express';
import {
  PLATFORM_EVENTS,
  PlatformEventPayloadMap,
} from '../../events';
import { ValidationRejectedException } from '../pipes/strict-validation.pipe';


@Catch(ValidationRejectedException)
export class ValidationRejectionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ValidationRejectionFilter.name);

  constructor(private readonly eventEmitter: EventEmitter2) { }

  catch(exception: ValidationRejectedException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const event = {
      reason: 'validation',
      path: req.path,
      ip: req.ip ?? '',
    };

    this.logger.warn({ msg: 'Request rejected by validation', ...event });
    this.eventEmitter.emit(PLATFORM_EVENTS.SECURITY_REQUEST_REJECTED, event satisfies PlatformEventPayloadMap[typeof PLATFORM_EVENTS.SECURITY_REQUEST_REJECTED]);

    res.status(exception.getStatus()).json(exception.getResponse());
  }
}
