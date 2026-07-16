import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-linkedin-oauth2';
import { AUTH_MODULE_CONFIG, AuthModuleConfig } from '../auth.config';
import { OauthProfile } from '../auth.service';

interface LinkedInProfile {
  emails?: { value: string }[];
}

@Injectable()
export class LinkedInStrategy extends PassportStrategy(Strategy, 'linkedin') {
  constructor(@Inject(AUTH_MODULE_CONFIG) config: AuthModuleConfig) {
    const oauth = config.oauth?.linkedin;
    // Same placeholder rationale as GoogleStrategy.
    super({
      clientID: oauth?.clientId ?? 'disabled',
      clientSecret: oauth?.clientSecret ?? 'disabled',
      callbackURL: oauth?.callbackUrl ?? 'disabled',
      scope: ['r_emailaddress', 'r_liteprofile'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: LinkedInProfile,
  ): OauthProfile {
    return { email: profile.emails?.[0]?.value ?? null };
  }
}
