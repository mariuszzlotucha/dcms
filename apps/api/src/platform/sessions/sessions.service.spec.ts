import { createHash } from 'crypto';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { IsNull } from 'typeorm';
import { PLATFORM_EVENTS } from '../events';
import { SecretsService } from '../secrets/secrets.service';
import { SessionsModuleConfig } from './sessions.config';
import { SessionsService } from './sessions.service';
import { Session } from './entities/session.entity';

const hashOf = (token: string) => createHash('sha256').update(token).digest('hex');

describe('SessionsService', () => {
  let sessions: { save: jest.Mock; create: jest.Mock; findOne: jest.Mock; update: jest.Mock; find: jest.Mock };
  let users: { findOne: jest.Mock };
  let config: SessionsModuleConfig;
  let jwtService: { sign: jest.Mock };
  let secrets: { getJwtSigningKey: jest.Mock };
  let eventEmitter: { emit: jest.Mock };
  let service: SessionsService;

  beforeEach(() => {
    sessions = {
      save: jest.fn(async (data) => ({ id: 's1', ...data }) as Session),
      create: jest.fn((data) => data),
      findOne: jest.fn(),
      update: jest.fn(),
      find: jest.fn(),
    };
    users = { findOne: jest.fn() };
    config = { refreshTokenExpiresIn: '30d', csrfEnabled: false };
    jwtService = { sign: jest.fn().mockReturnValue('signed-access-token') };
    secrets = { getJwtSigningKey: jest.fn().mockReturnValue('jwt-secret') };
    eventEmitter = { emit: jest.fn() };

    service = new SessionsService(
      sessions as never,
      users as never,
      config,
      jwtService as unknown as JwtService,
      secrets as unknown as SecretsService,
      eventEmitter as unknown as EventEmitter2,
    );
  });

  describe('createSession', () => {
    it('stores only the hash of the refresh token, never the raw value', async () => {
      const result = await service.createSession('u1');

      expect(sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'u1', refreshTokenHash: hashOf(result.refreshToken), revokedAt: null }),
      );
    });

    it('returns the raw (unhashed) refresh token to the caller', async () => {
      const result = await service.createSession('u1');

      expect(sessions.create).not.toHaveBeenCalledWith(
        expect.objectContaining({ refreshTokenHash: result.refreshToken }),
      );
    });

    it('sets an expiry consistent with the configured refreshTokenExpiresIn', async () => {
      const before = Date.now();
      const result = await service.createSession('u1');
      const after = Date.now();

      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(before + thirtyDaysMs - 1000);
      expect(result.expiresAt.getTime()).toBeLessThanOrEqual(after + thirtyDaysMs + 1000);
    });

    it('generates a different refresh token on each call', async () => {
      const first = await service.createSession('u1');
      const second = await service.createSession('u1');

      expect(first.refreshToken).not.toBe(second.refreshToken);
    });

    it('throws when refreshTokenExpiresIn is not a valid duration string', async () => {
      const badConfig: SessionsModuleConfig = { refreshTokenExpiresIn: 'not-a-duration', csrfEnabled: false };
      const badService = new SessionsService(
        sessions as never,
        users as never,
        badConfig,
        jwtService as unknown as JwtService,
        secrets as unknown as SecretsService,
        eventEmitter as unknown as EventEmitter2,
      );

      await expect(badService.createSession('u1')).rejects.toThrow(
        'SessionsModuleConfig.refreshTokenExpiresIn must be a positive duration like "30d"',
      );
    });
  });

  describe('rotateSession', () => {
    const activeSession = (): Session =>
      ({
        id: 's1',
        userId: 'u1',
        refreshTokenHash: hashOf('old-token'),
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
        createdAt: new Date(),
      }) as Session;

    it('rejects an unknown refresh token', async () => {
      sessions.findOne.mockResolvedValue(null);

      await expect(service.rotateSession('bogus')).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a revoked session', async () => {
      sessions.findOne.mockResolvedValue({ ...activeSession(), revokedAt: new Date() });

      await expect(service.rotateSession('old-token')).rejects.toThrow(UnauthorizedException);
    });

    it('rejects an expired session', async () => {
      sessions.findOne.mockResolvedValue({ ...activeSession(), expiresAt: new Date(Date.now() - 1000) });

      await expect(service.rotateSession('old-token')).rejects.toThrow(UnauthorizedException);
    });

    it('rejects when the session references a user that no longer exists', async () => {
      sessions.findOne.mockResolvedValue(activeSession());
      users.findOne.mockResolvedValue(null);

      await expect(service.rotateSession('old-token')).rejects.toThrow(UnauthorizedException);
    });

    it('rotates the hash in place (same session row) and returns fresh tokens', async () => {
      const session = activeSession();
      sessions.findOne.mockResolvedValue(session);
      users.findOne.mockResolvedValue({ id: 'u1', email: 'a@example.com' });

      const result = await service.rotateSession('old-token');

      expect(sessions.save).toHaveBeenCalledWith(expect.objectContaining({ id: 's1' }));
      const saved = sessions.save.mock.calls[0][0] as Session;
      expect(saved.refreshTokenHash).not.toBe(hashOf('old-token'));
      expect(saved.refreshTokenHash).toBe(hashOf(result.refreshToken));
      expect(result.accessToken).toBe('signed-access-token');
    });

    it('does not emit SESSION_REVOKED for a routine rotation', async () => {
      sessions.findOne.mockResolvedValue(activeSession());
      users.findOne.mockResolvedValue({ id: 'u1', email: 'a@example.com' });

      await service.rotateSession('old-token');

      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('signs the new access token with the auth-compatible payload shape and configured expiry', async () => {
      sessions.findOne.mockResolvedValue(activeSession());
      users.findOne.mockResolvedValue({ id: 'u1', email: 'a@example.com' });

      await service.rotateSession('old-token');

      expect(jwtService.sign).toHaveBeenCalledWith(
        { sub: 'u1', email: 'a@example.com' },
        { secret: 'jwt-secret', expiresIn: '15m' },
      );
    });

    it('uses the configured accessTokenExpiresIn when provided', async () => {
      const customConfig: SessionsModuleConfig = {
        refreshTokenExpiresIn: '30d',
        accessTokenExpiresIn: '5m',
        csrfEnabled: false,
      };
      const customService = new SessionsService(
        sessions as never,
        users as never,
        customConfig,
        jwtService as unknown as JwtService,
        secrets as unknown as SecretsService,
        eventEmitter as unknown as EventEmitter2,
      );
      sessions.findOne.mockResolvedValue(activeSession());
      users.findOne.mockResolvedValue({ id: 'u1', email: 'a@example.com' });

      await customService.rotateSession('old-token');

      expect(jwtService.sign).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ expiresIn: '5m' }));
    });
  });

  describe('revokeSession', () => {
    it('scopes the update by both sessionId and userId, and emits SESSION_REVOKED', async () => {
      sessions.update.mockResolvedValue({ affected: 1 });

      await service.revokeSession('s1', 'u1');

      expect(sessions.update).toHaveBeenCalledWith(
        { id: 's1', userId: 'u1', revokedAt: IsNull() },
        { revokedAt: expect.any(Date) },
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(PLATFORM_EVENTS.SESSION_REVOKED, {
        userId: 'u1',
        sessionId: 's1',
        revokedBy: 'user',
      });
    });

    it('throws NotFoundException when no row matched (wrong owner or already revoked)', async () => {
      sessions.update.mockResolvedValue({ affected: 0 });

      await expect(service.revokeSession('s1', 'someone-elses-id')).rejects.toThrow(NotFoundException);
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });
  });

  describe('revokeAllSessions', () => {
    it('returns 0 and skips the update when there are no active sessions', async () => {
      sessions.find.mockResolvedValue([]);

      const count = await service.revokeAllSessions('u1');

      expect(count).toBe(0);
      expect(sessions.update).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('revokes every active session and emits one event per session', async () => {
      sessions.find.mockResolvedValue([{ id: 's1' }, { id: 's2' }]);

      const count = await service.revokeAllSessions('u1');

      expect(count).toBe(2);
      expect(sessions.update).toHaveBeenCalledWith(
        { userId: 'u1', revokedAt: IsNull() },
        { revokedAt: expect.any(Date) },
      );
      expect(eventEmitter.emit).toHaveBeenCalledTimes(2);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        PLATFORM_EVENTS.SESSION_REVOKED,
        expect.objectContaining({ sessionId: 's1' }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        PLATFORM_EVENTS.SESSION_REVOKED,
        expect.objectContaining({ sessionId: 's2' }),
      );
    });
  });

  describe('listActiveSessions', () => {
    it('queries only non-revoked, non-expired sessions for the user, newest first', async () => {
      sessions.find.mockResolvedValue([]);

      await service.listActiveSessions('u1');

      expect(sessions.find).toHaveBeenCalledTimes(1);
      const query = sessions.find.mock.calls[0][0];
      expect(query.where.userId).toBe('u1');
      expect(query.where.revokedAt).toEqual(IsNull());
      expect(query.where.expiresAt.type).toBe('moreThan');
      expect(query.select).toEqual({ id: true, createdAt: true, expiresAt: true });
      expect(query.order).toEqual({ createdAt: 'DESC' });
    });
  });
});
