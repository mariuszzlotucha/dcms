import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-google-oauth20';
import { AUTH_MODULE_CONFIG, AuthModuleConfig } from '../auth.config';
import { OauthProfile } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(@Inject(AUTH_MODULE_CONFIG) config: AuthModuleConfig) {
    const oauth = config.oauth?.google;
    // DI constructs every strategy eagerly, and async config can't
    // conditionally register providers — so an unconfigured provider gets
    // non-throwing placeholders here, and OauthGuard blocks its routes
    // with a 404 before any redirect can happen.
    super({
      clientID: oauth?.clientId ?? 'disabled',
      clientSecret: oauth?.clientSecret ?? 'disabled',
      callbackURL: oauth?.callbackUrl ?? 'disabled',
      scope: ['email', 'profile'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ): OauthProfile {
    return { email: profile.emails?.[0]?.value ?? null };
  }
}
