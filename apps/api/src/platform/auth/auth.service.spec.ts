import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import * as argon2 from 'argon2';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { PLATFORM_EVENTS } from '../events';
import { SecretsService } from '../secrets/secrets.service';
import { PasswordPolicyService } from '../password-policy/password-policy.service';
import { AuthModuleConfig } from './auth.config';
import { AuthService } from './auth.service';
import { User } from './entities/user.entity';

jest.mock('argon2');

const mockedArgon2 = argon2 as jest.Mocked<typeof argon2>;

function buildUniqueViolation(): QueryFailedError {
  return new QueryFailedError('INSERT INTO users ...', [], {
    code: '23505',
    toString: () => 'duplicate key value violates unique constraint',
  } as never);
}

describe('AuthService', () => {
  let users: { findOne: jest.Mock; findOneOrFail: jest.Mock; save: jest.Mock; create: jest.Mock };
  let config: AuthModuleConfig;
  let jwtService: { sign: jest.Mock };
  let secrets: { getJwtSigningKey: jest.Mock };
  let passwordPolicy: {
    validateStrength: jest.Mock;
    isLockedOut: jest.Mock;
    recordFailedAttempt: jest.Mock;
    clearFailedAttempts: jest.Mock;
  };
  let eventEmitter: { emit: jest.Mock };
  let service: AuthService;

  beforeEach(() => {
    mockedArgon2.hash.mockResolvedValue('dummy-hash' as never);
    mockedArgon2.verify.mockResolvedValue(false as never);

    users = {
      findOne: jest.fn().mockResolvedValue(null),
      findOneOrFail: jest.fn(),
      save: jest.fn(async (data) => ({ id: 'u1', tenantId: null, ...data }) as User),
      create: jest.fn((data) => data),
    };
    config = { jwtExpiresIn: '15m' };
    jwtService = { sign: jest.fn().mockReturnValue('signed-jwt') };
    secrets = { getJwtSigningKey: jest.fn().mockReturnValue('jwt-secret') };
    passwordPolicy = {
      validateStrength: jest.fn(),
      isLockedOut: jest.fn().mockResolvedValue(false),
      recordFailedAttempt: jest.fn(),
      clearFailedAttempts: jest.fn(),
    };
    eventEmitter = { emit: jest.fn() };

    service = new AuthService(
      users as never,
      config,
      jwtService as unknown as JwtService,
      secrets as unknown as SecretsService,
      passwordPolicy as unknown as PasswordPolicyService,
      eventEmitter as unknown as EventEmitter2,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('validates password strength before doing anything else', async () => {
      await service.register('New@Example.com', 'Password1');

      expect(passwordPolicy.validateStrength).toHaveBeenCalledWith('Password1');
    });

    it('normalizes the email (trim + lowercase) and hashes the password', async () => {
      await service.register('  New@Example.com  ', 'Password1');

      expect(mockedArgon2.hash).toHaveBeenCalledWith('Password1');
      expect(users.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'new@example.com', passwordHash: 'dummy-hash' }),
      );
    });

    it('returns signed tokens built from the saved user', async () => {
      const result = await service.register('new@example.com', 'Password1');

      expect(jwtService.sign).toHaveBeenCalledWith(
        { sub: 'u1', email: 'new@example.com' },
        { secret: 'jwt-secret', expiresIn: '15m' },
      );
      expect(result).toEqual({ accessToken: 'signed-jwt' });
    });

    it('emits AUTH_USER_REGISTERED with an empty tenantId placeholder', async () => {
      await service.register('new@example.com', 'Password1');

      expect(eventEmitter.emit).toHaveBeenCalledWith(PLATFORM_EVENTS.AUTH_USER_REGISTERED, {
        userId: 'u1',
        email: 'new@example.com',
        tenantId: '',
      });
    });

    it('throws ConflictException when the email is already registered (unique violation)', async () => {
      users.save.mockRejectedValueOnce(buildUniqueViolation());

      await expect(service.register('taken@example.com', 'Password1')).rejects.toThrow(ConflictException);
      expect(eventEmitter.emit).not.toHaveBeenCalledWith(PLATFORM_EVENTS.AUTH_USER_REGISTERED, expect.anything());
    });

    it('rethrows unrelated database errors unchanged', async () => {
      const otherError = new Error('connection lost');
      users.save.mockRejectedValueOnce(otherError);

      await expect(service.register('new@example.com', 'Password1')).rejects.toThrow('connection lost');
    });
  });

  describe('login', () => {
    it('rejects a locked-out account without attempting password verification', async () => {
      users.findOne.mockResolvedValue({ id: 'u1', email: 'user@example.com', passwordHash: 'hash' } as User);
      passwordPolicy.isLockedOut.mockResolvedValue(true);

      await expect(service.login('user@example.com', 'wrong', '1.2.3.4')).rejects.toThrow(UnauthorizedException);
      expect(mockedArgon2.verify).not.toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        PLATFORM_EVENTS.AUTH_USER_LOGIN_FAILED,
        { email: 'user@example.com', reason: 'account_locked', ip: '1.2.3.4' },
      );
    });

    it('verifies against a dummy hash (timing parity) when the user does not exist', async () => {
      users.findOne.mockResolvedValue(null);

      await expect(service.login('nobody@example.com', 'whatever', '1.2.3.4')).rejects.toThrow(UnauthorizedException);

      expect(mockedArgon2.verify).toHaveBeenCalledWith('dummy-hash', 'whatever');
      expect(passwordPolicy.recordFailedAttempt).not.toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        PLATFORM_EVENTS.AUTH_USER_LOGIN_FAILED,
        { email: 'nobody@example.com', reason: 'invalid_credentials', ip: '1.2.3.4' },
      );
    });

    it('verifies against the dummy hash (not user.passwordHash) for an OAuth-only user with no password', async () => {
      users.findOne.mockResolvedValue({ id: 'u1', email: 'oauth@example.com', passwordHash: null } as User);

      await expect(service.login('oauth@example.com', 'whatever', '1.2.3.4')).rejects.toThrow(UnauthorizedException);

      expect(mockedArgon2.verify).toHaveBeenCalledWith('dummy-hash', 'whatever');
      // Unlike the nonexistent-user case, a real account CAN be locked here.
      expect(passwordPolicy.recordFailedAttempt).toHaveBeenCalledWith('u1');
    });

    it('records a failed attempt and rejects on a wrong password for an existing user', async () => {
      users.findOne.mockResolvedValue({ id: 'u1', email: 'user@example.com', passwordHash: 'real-hash' } as User);
      mockedArgon2.verify.mockResolvedValue(false as never);

      await expect(service.login('user@example.com', 'wrong', '1.2.3.4')).rejects.toThrow(UnauthorizedException);

      expect(mockedArgon2.verify).toHaveBeenCalledWith('real-hash', 'wrong');
      expect(passwordPolicy.recordFailedAttempt).toHaveBeenCalledWith('u1');
    });

    it('clears failed attempts and returns tokens on a correct password', async () => {
      users.findOne.mockResolvedValue({
        id: 'u1',
        email: 'user@example.com',
        passwordHash: 'real-hash',
        tenantId: 't1',
      } as User);
      mockedArgon2.verify.mockResolvedValue(true as never);

      const result = await service.login('user@example.com', 'correct', '1.2.3.4');

      expect(passwordPolicy.clearFailedAttempts).toHaveBeenCalledWith('u1');
      expect(result).toEqual({ accessToken: 'signed-jwt' });
      expect(eventEmitter.emit).toHaveBeenCalledWith(PLATFORM_EVENTS.AUTH_USER_LOGGED_IN, {
        userId: 'u1',
        tenantId: 't1',
        method: 'password',
      });
    });
  });

  describe('oauthLogin', () => {
    it('rejects a profile with no email', async () => {
      await expect(service.oauthLogin({ email: null }, 'google', '1.2.3.4')).rejects.toThrow(
        'google account did not provide an email address',
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(PLATFORM_EVENTS.AUTH_USER_LOGIN_FAILED, {
        email: '',
        reason: 'google_profile_missing_email',
        ip: '1.2.3.4',
      });
    });

    it('logs in an existing user without creating a new one', async () => {
      users.findOne.mockResolvedValue({ id: 'u1', email: 'existing@example.com', tenantId: null } as User);

      await service.oauthLogin({ email: 'existing@example.com' }, 'google', '1.2.3.4');

      expect(users.save).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalledWith(PLATFORM_EVENTS.AUTH_USER_REGISTERED, expect.anything());
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        PLATFORM_EVENTS.AUTH_USER_LOGGED_IN,
        expect.objectContaining({ method: 'oauth' }),
      );
    });

    it('creates a new user with no password when none exists, and emits both registered and logged-in', async () => {
      users.findOne.mockResolvedValue(null);

      await service.oauthLogin({ email: 'new@example.com' }, 'linkedin', '1.2.3.4');

      expect(users.create).toHaveBeenCalledWith({ email: 'new@example.com', passwordHash: null });
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        PLATFORM_EVENTS.AUTH_USER_REGISTERED,
        expect.objectContaining({ email: 'new@example.com' }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        PLATFORM_EVENTS.AUTH_USER_LOGGED_IN,
        expect.objectContaining({ method: 'oauth' }),
      );
    });

    it('recovers from a concurrent-insert race by loading the row the winner created', async () => {
      users.findOne.mockResolvedValueOnce(null);
      users.save.mockRejectedValueOnce(buildUniqueViolation());
      users.findOneOrFail.mockResolvedValue({ id: 'u1', email: 'new@example.com', tenantId: null } as User);

      await service.oauthLogin({ email: 'new@example.com' }, 'google', '1.2.3.4');

      expect(users.findOneOrFail).toHaveBeenCalledWith({ where: { email: 'new@example.com' } });
      // The loser of the race didn't create the row, so it must not claim credit for registering it.
      expect(eventEmitter.emit).not.toHaveBeenCalledWith(PLATFORM_EVENTS.AUTH_USER_REGISTERED, expect.anything());
    });

    it('rethrows a non-unique-violation error during user creation', async () => {
      users.findOne.mockResolvedValueOnce(null);
      const otherError = new Error('connection lost');
      users.save.mockRejectedValueOnce(otherError);

      await expect(service.oauthLogin({ email: 'new@example.com' }, 'google', '1.2.3.4')).rejects.toThrow(
        'connection lost',
      );
    });
  });
});
