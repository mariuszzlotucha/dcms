import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { QueryFailedError, Repository } from 'typeorm';
import { PLATFORM_EVENTS, PlatformEventPayloadMap } from '../events';
import { SecretsService } from '../secrets/secrets.service';
import {
  AUTH_MODULE_CONFIG,
  AuthModuleConfig,
  OauthProviderName,
} from './auth.config';
import { User } from './entities/user.entity';

export interface JwtPayload {
  sub: string;
  email: string;
}

export interface AuthTokens {
  accessToken: string;
}

export interface OauthProfile {
  email: string | null;
}

const PG_UNIQUE_VIOLATION = '23505';

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    (error.driverError as { code?: string } | undefined)?.code ===
      PG_UNIQUE_VIOLATION
  );
}

// Emails are normalized on every write and lookup so 'User@X.pl' and
// 'user@x.pl' cannot become two accounts (varchar unique is case-sensitive
// in Postgres).
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @Inject(AUTH_MODULE_CONFIG) private readonly config: AuthModuleConfig,
    private readonly jwtService: JwtService,
    private readonly secrets: SecretsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async register(rawEmail: string, password: string): Promise<AuthTokens> {
    const email = normalizeEmail(rawEmail);
    const passwordHash = await argon2.hash(password);

    let user: User;
    try {
      user = await this.users.save(this.users.create({ email, passwordHash }));
    } catch (error) {
      // No pre-check findOne: two concurrent registrations would both pass
      // it anyway, so the unique index is the only reliable arbiter.
      if (isUniqueViolation(error)) {
        throw new ConflictException('Email is already registered');
      }
      throw error;
    }

    const tokens = this.issueTokens(user);
    this.emitRegistered(user);
    return tokens;
  }

  async login(
    rawEmail: string,
    password: string,
    ip: string,
  ): Promise<AuthTokens> {
    const email = normalizeEmail(rawEmail);
    const user = await this.users.findOne({ where: { email } });
    const valid =
      user?.passwordHash != null &&
      (await argon2.verify(user.passwordHash, password));

    if (!user || !valid) {
      this.eventEmitter.emit(PLATFORM_EVENTS.AUTH_USER_LOGIN_FAILED, {
        email,
        reason: 'invalid_credentials',
        ip,
      } satisfies PlatformEventPayloadMap[typeof PLATFORM_EVENTS.AUTH_USER_LOGIN_FAILED]);
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = this.issueTokens(user);
    this.emitLoggedIn(user, 'password');
    return tokens;
  }

  async oauthLogin(
    profile: OauthProfile,
    method: OauthProviderName,
    ip: string,
  ): Promise<AuthTokens> {
    if (!profile.email) {
      this.eventEmitter.emit(PLATFORM_EVENTS.AUTH_USER_LOGIN_FAILED, {
        email: '',
        reason: `${method}_profile_missing_email`,
        ip,
      } satisfies PlatformEventPayloadMap[typeof PLATFORM_EVENTS.AUTH_USER_LOGIN_FAILED]);
      throw new UnauthorizedException(
        `${method} account did not provide an email address`,
      );
    }

    const email = normalizeEmail(profile.email);
    let user = await this.users.findOne({ where: { email } });
    let created = false;

    if (!user) {
      try {
        user = await this.users.save(
          this.users.create({ email, passwordHash: null }),
        );
        created = true;
      } catch (error) {
        // Two concurrent callbacks for a brand-new user: the loser of the
        // insert race recovers by loading the row the winner just created.
        if (!isUniqueViolation(error)) {
          throw error;
        }
        user = await this.users.findOneOrFail({ where: { email } });
      }
    }

    const tokens = this.issueTokens(user);
    if (created) {
      this.emitRegistered(user);
    }
    this.emitLoggedIn(user, method);
    return tokens;
  }

  // tenantId contract in PlatformEventPayloadMap is a non-null string
  // (designed for when tenants exists); until then users have no tenant,
  // so '' is the pre-tenants placeholder.
  private emitRegistered(user: User): void {
    this.eventEmitter.emit(PLATFORM_EVENTS.AUTH_USER_REGISTERED, {
      userId: user.id,
      email: user.email,
      tenantId: user.tenantId ?? '',
    } satisfies PlatformEventPayloadMap[typeof PLATFORM_EVENTS.AUTH_USER_REGISTERED]);
  }

  private emitLoggedIn(
    user: User,
    method: 'password' | OauthProviderName,
  ): void {
    this.eventEmitter.emit(PLATFORM_EVENTS.AUTH_USER_LOGGED_IN, {
      userId: user.id,
      tenantId: user.tenantId ?? '',
      method: method === 'password' ? 'password' : 'oauth',
    } satisfies PlatformEventPayloadMap[typeof PLATFORM_EVENTS.AUTH_USER_LOGGED_IN]);
  }

  // JwtModule is registered without options on purpose — the signing key
  // lives in SecretsService (not in module config), so it is passed
  // explicitly on every sign instead of being baked into JwtModule at boot.
  private issueTokens(user: User): AuthTokens {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    return {
      accessToken: this.jwtService.sign(payload, {
        secret: this.secrets.getJwtSigningKey(),
        // Config keeps plain string (env-sourced); jsonwebtoken v9 types
        // narrow expiresIn to number | ms.StringValue, hence the cast.
        expiresIn: this.config.jwtExpiresIn as JwtSignOptions['expiresIn'],
      }),
    };
  }
}
