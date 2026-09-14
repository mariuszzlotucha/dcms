import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, StrategyOption } from 'passport-linkedin-oauth2';
import { AUTH_MODULE_CONFIG, AuthModuleConfig } from '../auth.config';
import { OauthProfile } from '../auth.service';
import { OauthStateStore } from '../oauth/oauth-state.store';

interface LinkedInProfile {
  emails?: { value: string }[];
}

@Injectable()
export class LinkedInStrategy extends PassportStrategy(Strategy, 'linkedin') {
  constructor(
    @Inject(AUTH_MODULE_CONFIG) config: AuthModuleConfig,
    oauthStateStore: OauthStateStore,
  ) {
    const oauth = config.oauth?.linkedin;
    // Same placeholder rationale, and same session-less CSRF-state store,
    // as GoogleStrategy.
    super({
      clientID: oauth?.clientId ?? 'disabled',
      clientSecret: oauth?.clientSecret ?? 'disabled',
      callbackURL: oauth?.callbackUrl ?? 'disabled',
      scope: ['r_emailaddress', 'r_liteprofile'],
      // `store` is a real, runtime-supported passport-oauth2 option that
      // @types/passport-linkedin-oauth2 doesn't declare — hence the cast.
      store: oauthStateStore,
    } as StrategyOption & { store: OauthStateStore });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: LinkedInProfile,
  ): OauthProfile {
    return { email: profile.emails?.[0]?.value ?? null };
  }
}
