import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { AuthModuleConfig } from '../auth.config';
import { OauthGuard } from './oauth.guard';

describe('OauthGuard', () => {
  const context = {} as ExecutionContext;

  it('throws NotFoundException when the provider is not configured', () => {
    const GuardClass = OauthGuard('google');
    const guard = new GuardClass({} as AuthModuleConfig);

    expect(() => guard.canActivate(context)).toThrow(NotFoundException);
    expect(() => guard.canActivate(context)).toThrow('google login is not enabled');
  });

  it('delegates to the underlying passport AuthGuard when the provider is configured', () => {
    const GuardClass = OauthGuard('google');
    const guard = new GuardClass({
      oauth: { google: { clientId: 'id', clientSecret: 'secret', callbackUrl: 'https://cb' } },
    } as AuthModuleConfig);

    const parentCanActivate = jest
      .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(guard)), 'canActivate')
      .mockReturnValue(true);

    expect(guard.canActivate(context)).toBe(true);
    expect(parentCanActivate).toHaveBeenCalledWith(context);

    parentCanActivate.mockRestore();
  });

  it('produces an independent, provider-specific guard class for each call', () => {
    const GoogleGuard = OauthGuard('google');
    const guard = new GoogleGuard({} as AuthModuleConfig);

    expect(() => guard.canActivate(context)).toThrow('google login is not enabled');
  });
});
