import { buildCookieOptions, SecurityModuleConfig } from './security.config';

describe('buildCookieOptions', () => {
  const baseConfig: SecurityModuleConfig = { cors: { allowedOrigins: [] } };

  it('defaults to httpOnly, secure, and sameSite: lax when nothing is configured', () => {
    expect(buildCookieOptions(baseConfig)).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
    });
  });

  it('always sets httpOnly: true regardless of config (not configurable)', () => {
    expect(buildCookieOptions({ ...baseConfig, cookies: { secure: false, sameSite: 'none' } }).httpOnly).toBe(true);
  });

  it('respects a configured secure: false', () => {
    expect(buildCookieOptions({ ...baseConfig, cookies: { secure: false } }).secure).toBe(false);
  });

  it('respects a configured sameSite', () => {
    expect(buildCookieOptions({ ...baseConfig, cookies: { sameSite: 'strict' } }).sameSite).toBe('strict');
  });
});
