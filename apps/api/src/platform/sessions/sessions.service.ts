import {
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import ms, { type StringValue } from 'ms';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { JwtPayload } from '../auth/auth.service';
import { User } from '../auth/entities/user.entity';
import { PLATFORM_EVENTS, PlatformEventPayloadMap } from '../events';
import { SecretsService } from '../secrets/secrets.service';
import {
  SESSIONS_MODULE_CONFIG,
  SessionsModuleConfig,
} from './sessions.config';
import { Session } from './entities/session.entity';

export interface IssuedRefreshToken {
  sessionId: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface RotatedTokens {
  accessToken: string;
  refreshToken: string;
}

export interface ActiveSession {
  id: string;
  createdAt: Date;
  expiresAt: Date;
}

// sha256, not argon2, on purpose: this is a lookup-by-hash of a
// high-entropy random token on every refresh, not a low-entropy password —
// a fast hash is correct here and argon2's deliberate slowness would be a
// per-request performance problem.
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function generateRawToken(): string {
  return randomBytes(48).toString('base64url');
}

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(Session)
    private readonly sessions: Repository<Session>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @Inject(SESSIONS_MODULE_CONFIG)
    private readonly config: SessionsModuleConfig,
    private readonly jwtService: JwtService,
    private readonly secrets: SecretsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createSession(userId: string): Promise<IssuedRefreshToken> {
    const refreshToken = generateRawToken();
    const expiresAt = new Date(Date.now() + this.refreshTtlMs());

    const session = await this.sessions.save(
      this.sessions.create({
        userId,
        refreshTokenHash: hashToken(refreshToken),
        expiresAt,
        revokedAt: null,
      }),
    );

    return { sessionId: session.id, refreshToken, expiresAt };
  }

  async rotateSession(refreshToken: string): Promise<RotatedTokens> {
    const session = await this.sessions.findOne({
      where: { refreshTokenHash: hashToken(refreshToken) },
    });

    if (
      !session ||
      session.revokedAt !== null ||
      session.expiresAt <= new Date()
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.users.findOne({ where: { id: session.userId } });
    if (!user) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Rotation updates the same row (new hash + fresh expiry) instead of
    // creating a new one: the old token dies the instant the hash changes,
    // the session id stays stable for listActiveSessions, and no
    // SESSION_REVOKED noise is emitted for routine rotations.
    const newRefreshToken = generateRawToken();
    session.refreshTokenHash = hashToken(newRefreshToken);
    session.expiresAt = new Date(Date.now() + this.refreshTtlMs());
    await this.sessions.save(session);

    return {
      accessToken: this.issueAccessToken(user),
      refreshToken: newRefreshToken,
    };
  }

  async revokeSession(sessionId: string, userId: string): Promise<void> {
    // userId in the WHERE clause, not just sessionId: without it any
    // authenticated user could revoke anyone's session by guessing ids.
    const result = await this.sessions.update(
      { id: sessionId, userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
    if (!result.affected) {
      throw new NotFoundException('Session not found');
    }
    this.emitRevoked(userId, sessionId);
  }

  async revokeAllSessions(userId: string): Promise<number> {
    const active = await this.sessions.find({
      where: { userId, revokedAt: IsNull() },
    });
    if (active.length === 0) {
      return 0;
    }

    await this.sessions.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );

    for (const session of active) {
      this.emitRevoked(userId, session.id);
    }
    return active.length;
  }

  listActiveSessions(userId: string): Promise<ActiveSession[]> {
    return this.sessions.find({
      where: {
        userId,
        revokedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
      select: { id: true, createdAt: true, expiresAt: true },
      order: { createdAt: 'DESC' },
    });
  }

  private emitRevoked(userId: string, sessionId: string): void {
    this.eventEmitter.emit(PLATFORM_EVENTS.SESSION_REVOKED, {
      userId,
      sessionId,
      revokedBy: 'user',
    } satisfies PlatformEventPayloadMap[typeof PLATFORM_EVENTS.SESSION_REVOKED]);
  }

  private refreshTtlMs(): number {
    const ttl = ms(this.config.refreshTokenExpiresIn as StringValue);
    if (typeof ttl !== 'number' || ttl <= 0) {
      throw new Error(
        'SessionsModuleConfig.refreshTokenExpiresIn must be a positive duration like "30d"',
      );
    }
    return ttl;
  }

  // Access-token issuance mirrors auth's issueTokens by design constraint:
  // auth must not change, its issueTokens is private, and its dynamic
  // module instance is not reachable from here. The parts that matter stay
  // single-sourced — payload shape (auth's JwtPayload) and signing key
  // (SecretsService).
  private issueAccessToken(user: User): string {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    return this.jwtService.sign(payload, {
      secret: this.secrets.getJwtSigningKey(),
      expiresIn: (this.config.accessTokenExpiresIn ??
        '15m') as JwtSignOptions['expiresIn'],
    });
  }
}
