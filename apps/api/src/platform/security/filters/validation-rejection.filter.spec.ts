import { ArgumentsHost } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PLATFORM_EVENTS } from '../../events';
import { ValidationRejectionFilter } from './validation-rejection.filter';
import { ValidationRejectedException } from '../pipes/strict-validation.pipe';

describe('ValidationRejectionFilter', () => {
  let eventEmitter: { emit: jest.Mock };
  let filter: ValidationRejectionFilter;
  let res: { status: jest.Mock; json: jest.Mock };
  let req: { path: string; ip?: string };
  let host: ArgumentsHost;

  beforeEach(() => {
    eventEmitter = { emit: jest.fn() };
    filter = new ValidationRejectionFilter(eventEmitter as unknown as EventEmitter2);
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    req = { path: '/api/contracts', ip: '203.0.113.5' };
    host = {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
    } as unknown as ArgumentsHost;
  });

  it('emits SECURITY_REQUEST_REJECTED with the request path and IP', () => {
    const exception = new ValidationRejectedException([]);

    filter.catch(exception, host);

    expect(eventEmitter.emit).toHaveBeenCalledWith(PLATFORM_EVENTS.SECURITY_REQUEST_REJECTED, {
      reason: 'validation',
      path: '/api/contracts',
      ip: '203.0.113.5',
    });
  });

  it('falls back to an empty string when req.ip is missing', () => {
    req.ip = undefined;
    const exception = new ValidationRejectedException([]);

    filter.catch(exception, host);

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      PLATFORM_EVENTS.SECURITY_REQUEST_REJECTED,
      expect.objectContaining({ ip: '' }),
    );
  });

  it('responds with the exception status and body', () => {
    const exception = new ValidationRejectedException([
      { property: 'email', constraints: { isEmail: 'email must be an email' } },
    ]);

    filter.catch(exception, host);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(exception.getResponse());
  });
});
