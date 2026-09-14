import { AuthModuleConfig } from '../auth.config';
import { LinkedInStrategy } from './linkedin.strategy';
import { OauthStateStore } from '../oauth/oauth-state.store';

describe('LinkedInStrategy', () => {
  const buildStrategy = (config: AuthModuleConfig) =>
    new LinkedInStrategy(config, {} as unknown as OauthStateStore);

  it('extracts the primary email from the profile', () => {
    const strategy = buildStrategy({ jwtExpiresIn: '15m' });

    const result = strategy.validate('token', 'refresh', { emails: [{ value: 'a@example.com' }] });

    expect(result).toEqual({ email: 'a@example.com' });
  });

  it('returns a null email when the profile has none', () => {
    const strategy = buildStrategy({ jwtExpiresIn: '15m' });

    const result = strategy.validate('token', 'refresh', { emails: [] });

    expect(result).toEqual({ email: null });
  });

  it('returns a null email when the profile omits the emails field entirely', () => {
    const strategy = buildStrategy({ jwtExpiresIn: '15m' });

    const result = strategy.validate('token', 'refresh', {});

    expect(result).toEqual({ email: null });
  });

  it('constructs with disabled placeholders when linkedin oauth is not configured (no throw)', () => {
    expect(() => buildStrategy({ jwtExpiresIn: '15m' })).not.toThrow();
  });
});
