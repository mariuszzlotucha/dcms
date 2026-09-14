import { NotFoundException } from '@nestjs/common';
import { SecurityController } from './security.controller';
import { CsrfService } from './csrf/csrf.service';

describe('SecurityController', () => {
  let csrfService: { enabled: boolean; generateToken: jest.Mock };
  let controller: SecurityController;

  beforeEach(() => {
    csrfService = { enabled: true, generateToken: jest.fn() };
    controller = new SecurityController(csrfService as unknown as CsrfService);
  });

  it('returns a generated CSRF token when csrf is enabled', () => {
    csrfService.generateToken.mockReturnValue('token-123');
    const req = {} as never;
    const res = {} as never;

    expect(controller.getCsrfToken(req, res)).toEqual({ csrfToken: 'token-123' });
    expect(csrfService.generateToken).toHaveBeenCalledWith(req, res);
  });

  it('throws NotFoundException when csrf protection is disabled', () => {
    csrfService.enabled = false;

    expect(() => controller.getCsrfToken({} as never, {} as never)).toThrow(NotFoundException);
    expect(csrfService.generateToken).not.toHaveBeenCalled();
  });
});
