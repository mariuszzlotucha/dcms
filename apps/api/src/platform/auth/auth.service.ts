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
import { Repository } from 'typeorm';
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

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @Inject(AUTH_MODULE_CONFIG) private readonly config: AuthModuleConfig,
    private readonly jwtService: JwtService,
    private readonly secrets: SecretsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async register(email: string, password: string): Promise<AuthTokens> {
    const existing = await this.users.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const user = await this.users.save(
      this.users.create({ email, passwordHash: await argon2.hash(password) }),
    );

    this.emitRegistered(user);
    return this.issueTokens(user);
  }

  async login(
    email: string,
    password: string,
    ip: string,
  ): Promise<AuthTokens> {
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

    this.emitLoggedIn(user, 'password');
    return this.issueTokens(user);
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

    let user = await this.users.findOne({ where: { email: profile.email } });
    if (!user) {
      user = await this.users.save(
        this.users.create({ email: profile.email, passwordHash: null }),
      );
      this.emitRegistered(user);
    }

    this.emitLoggedIn(user, method);
    return this.issueTokens(user);
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