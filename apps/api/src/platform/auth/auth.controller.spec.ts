import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let authService: {
    register: jest.Mock;
    login: jest.Mock;
    oauthLogin: jest.Mock;
  };
  let controller: AuthController;

  beforeEach(() => {
    authService = { register: jest.fn(), login: jest.fn(), oauthLogin: jest.fn() };
    controller = new AuthController(authService as unknown as AuthService);
  });

  it('delegates register to AuthService.register with the DTO fields', async () => {
    authService.register.mockResolvedValue({ accessToken: 't' });

    const result = await controller.register({ email: 'a@example.com', password: 'Password1' });

    expect(authService.register).toHaveBeenCalledWith('a@example.com', 'Password1');
    expect(result).toEqual({ accessToken: 't' });
  });

  it('delegates login to AuthService.login with email, password, and the caller IP', async () => {
    authService.login.mockResolvedValue({ accessToken: 't' });

    const result = await controller.login(
      { email: 'a@example.com', password: 'Password1' },
      '203.0.113.5',
    );

    expect(authService.login).toHaveBeenCalledWith('a@example.com', 'Password1', '203.0.113.5');
    expect(result).toEqual({ accessToken: 't' });
  });

  it('delegates the Google callback to AuthService.oauthLogin with req.user and the "google" method', async () => {
    authService.oauthLogin.mockResolvedValue({ accessToken: 't' });
    const req = { user: { email: 'g@example.com' } } as never;

    await controller.googleCallback(req, '203.0.113.5');

    expect(authService.oauthLogin).toHaveBeenCalledWith(
      { email: 'g@example.com' },
      'google',
      '203.0.113.5',
    );
  });

  it('delegates the LinkedIn callback to AuthService.oauthLogin with req.user and the "linkedin" method', async () => {
    authService.oauthLogin.mockResolvedValue({ accessToken: 't' });
    const req = { user: { email: 'l@example.com' } } as never;

    await controller.linkedinCallback(req, '203.0.113.5');

    expect(authService.oauthLogin).toHaveBeenCalledWith(
      { email: 'l@example.com' },
      'linkedin',
      '203.0.113.5',
    );
  });

  it('returns req.user unchanged from /me', () => {
    const req = { user: { userId: 'u1', email: 'a@example.com' } } as never;

    expect(controller.me(req)).toEqual({ userId: 'u1', email: 'a@example.com' });
  });
});
