import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { SecretsService } from '../../secrets/secrets.service';
import { JwtPayload } from '../auth.service';

export interface AuthenticatedUser {
  userId: string;
  email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(secrets: SecretsService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // secretOrKeyProvider (evaluated per request), not secretOrKey
      // (evaluated once at bootstrap): when secrets implements live
      // rotation, verification picks up the new key without a restart —
      // same property the signing side already has (AuthService calls
      // getJwtSigningKey() on every sign).
      secretOrKeyProvider: (
        _request: unknown,
        _rawJwtToken: unknown,
        done: (err: Error | null, secret?: string) => void,
      ) => {
        done(null, secrets.getJwtSigningKey());
      },
    });
  }

  validate(payload: JwtPayload): AuthenticatedUser {
    return { userId: payload.sub, email: payload.email };
  }
}
