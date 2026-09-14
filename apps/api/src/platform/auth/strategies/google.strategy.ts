import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy, StrategyOptions } from 'passport-google-oauth20';
import { AUTH_MODULE_CONFIG, AuthModuleConfig } from '../auth.config';
import { OauthProfile } from '../auth.service';
import { OauthStateStore } from '../oauth/oauth-state.store';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    @Inject(AUTH_MODULE_CONFIG) config: AuthModuleConfig,
    oauthStateStore: OauthStateStore,
  ) {
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
      // Not `state: true` — that requires express-session, which this app
      // doesn't run (PassportModule is `{ session: false }`). Without a
      // store, passport-oauth2 defaults to NullStore, i.e. no CSRF
      // protection on the OAuth flow. See OauthStateStore.
      //
      // `store` is a real, runtime-supported passport-oauth2 option that
      // @types/passport-google-oauth20 doesn't declare — hence the cast.
      store: oauthStateStore,
    } as StrategyOptions & { store: OauthStateStore });
  }

  validate(_accessToken: string, _refreshToken: string, profile: Profile): OauthProfile {
    return { email: profile.emails?.[0]?.value ?? null };
  }
}
