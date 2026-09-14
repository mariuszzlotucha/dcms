import { doubleCsrf } from 'csrf-csrf';
import { CsrfService } from './csrf.service';
import { SecurityModuleConfig } from '../security.config';

jest.mock('csrf-csrf');

describe('CsrfService', () => {
  const mockedDoubleCsrf = doubleCsrf as jest.MockedFunction<typeof doubleCsrf>;
  let validateRequest: jest.Mock;
  let generateToken: jest.Mock;

  beforeEach(() => {
    validateRequest = jest.fn();
    generateToken = jest.fn();
    mockedDoubleCsrf.mockReturnValue({
      validateRequest,
      generateToken,
    } as unknown as ReturnType<typeof doubleCsrf>);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const baseConfig: SecurityModuleConfig = { cors: { allowedOrigins: [] } };

  describe('when csrf is disabled (default)', () => {
    it('reports enabled: false and never constructs doubleCsrf', () => {
      const service = new CsrfService(baseConfig);

      expect(service.enabled).toBe(false);
      expect(mockedDoubleCsrf).not.toHaveBeenCalled();
    });

    it('validateRequest always returns false', () => {
      const service = new CsrfService(baseConfig);

      expect(service.validateRequest({} as never)).toBe(false);
    });

    it('generateToken throws', () => {
      const service = new CsrfService(baseConfig);

      expect(() => service.generateToken({} as never, {} as never)).toThrow(
        'CSRF protection is not enabled',
      );
    });
  });

  describe('when csrf is enabled', () => {
    it('throws at construction time if no secret is configured', () => {
      expect(
        () => new CsrfService({ ...baseConfig, csrf: { enabled: true } }),
      ).toThrow('SecurityModuleConfig.csrf.secret is required when csrf.enabled is true');
    });

    it('constructs doubleCsrf with the configured secret and cookie options', () => {
      new CsrfService({
        ...baseConfig,
        csrf: { enabled: true, secret: 'top-secret' },
        cookies: { sameSite: 'strict', secure: true },
      });

      expect(mockedDoubleCsrf).toHaveBeenCalledTimes(1);
      const callArgs = mockedDoubleCsrf.mock.calls[0][0];
      expect(callArgs.getSecret()).toBe('top-secret');
      expect(callArgs.cookieOptions).toEqual({ httpOnly: true, secure: true, sameSite: 'strict' });
    });

    it('delegates validateRequest to the doubleCsrf instance', () => {
      const service = new CsrfService({ ...baseConfig, csrf: { enabled: true, secret: 's' } });
      validateRequest.mockReturnValue(true);

      const req = { cookies: {} } as never;
      expect(service.validateRequest(req)).toBe(true);
      expect(validateRequest).toHaveBeenCalledWith(req);
    });

    it('delegates generateToken to the doubleCsrf instance', () => {
      const service = new CsrfService({ ...baseConfig, csrf: { enabled: true, secret: 's' } });
      generateToken.mockReturnValue('the-token');

      const req = {} as never;
      const res = {} as never;
      expect(service.generateToken(req, res)).toBe('the-token');
      expect(generateToken).toHaveBeenCalledWith(req, res);
    });
  });
});
