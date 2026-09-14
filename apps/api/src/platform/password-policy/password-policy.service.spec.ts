import { BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PLATFORM_EVENTS } from '../events';
import { PasswordPolicyService } from './password-policy.service';
import { PasswordPolicyModuleConfig } from './password-policy.config';

describe('PasswordPolicyService', () => {
  let failedLoginAttempts: {
    save: jest.Mock;
    create: jest.Mock;
    count: jest.Mock;
    delete: jest.Mock;
  };
  let eventEmitter: { emit: jest.Mock };
  let service: PasswordPolicyService;

  const config: PasswordPolicyModuleConfig = {
    minLength: 10,
    requireNumber: true,
    requireLetter: true,
    maxFailedAttempts: 5,
    lockoutDurationMinutes: 15,
  };

  beforeEach(() => {
    failedLoginAttempts = {
      save: jest.fn(),
      create: jest.fn((data) => data),
      count: jest.fn(),
      delete: jest.fn(),
    };
    eventEmitter = { emit: jest.fn() };

    service = new PasswordPolicyService(
      failedLoginAttempts as never,
      config,
      eventEmitter as unknown as EventEmitter2,
    );
  });

  describe('validateStrength', () => {
    it('accepts a password meeting every requirement', () => {
      expect(() => service.validateStrength('Password1!')).not.toThrow();
    });

    it('rejects a password shorter than the minimum length', () => {
      expect(() => service.validateStrength('Ab1')).toThrow(BadRequestException);
    });

    it('rejects a password with no number when one is required', () => {
      expect(() => service.validateStrength('NoNumberHere')).toThrow(
        'must contain at least one number',
      );
    });

    it('rejects a password with no letter when one is required', () => {
      expect(() => service.validateStrength('1234567890')).toThrow(
        'must contain at least one letter',
      );
    });

    it('combines every violated rule into a single error message', () => {
      expect(() => service.validateStrength('a')).toThrow(
        'Password must be at least 10 characters, must contain at least one number',
      );
    });

    it('skips the number/letter checks when the config does not require them', () => {
      const lenientConfig: PasswordPolicyModuleConfig = {
        ...config,
        requireNumber: false,
        requireLetter: false,
      };
      const lenientService = new PasswordPolicyService(
        failedLoginAttempts as never,
        lenientConfig,
        eventEmitter as unknown as EventEmitter2,
      );

      expect(() => lenientService.validateStrength('aaaaaaaaaa')).not.toThrow();
    });
  });

  describe('recordFailedAttempt', () => {
    it('records the attempt', async () => {
      failedLoginAttempts.count.mockResolvedValue(1);

      await service.recordFailedAttempt('u1');

      expect(failedLoginAttempts.create).toHaveBeenCalledWith({ userId: 'u1' });
      expect(failedLoginAttempts.save).toHaveBeenCalledWith({ userId: 'u1' });
    });

    it('does not emit PASSWORD_LOCKED_OUT while under the threshold', async () => {
      failedLoginAttempts.count.mockResolvedValue(3);

      await service.recordFailedAttempt('u1');

      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('emits PASSWORD_LOCKED_OUT the moment the count reaches the configured threshold', async () => {
      failedLoginAttempts.count.mockResolvedValue(5);

      await service.recordFailedAttempt('u1');

      expect(eventEmitter.emit).toHaveBeenCalledWith(PLATFORM_EVENTS.PASSWORD_LOCKED_OUT, {
        userId: 'u1',
        failedAttempts: 5,
      });
    });

    it('does not re-emit PASSWORD_LOCKED_OUT for attempts beyond the threshold', async () => {
      failedLoginAttempts.count.mockResolvedValue(6);

      await service.recordFailedAttempt('u1');

      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });
  });

  describe('isLockedOut', () => {
    it('returns false when the recent attempt count is below the threshold', async () => {
      failedLoginAttempts.count.mockResolvedValue(4);

      await expect(service.isLockedOut('u1')).resolves.toBe(false);
    });

    it('returns true once the recent attempt count reaches the threshold', async () => {
      failedLoginAttempts.count.mockResolvedValue(5);

      await expect(service.isLockedOut('u1')).resolves.toBe(true);
    });

    it('only counts attempts within the configured lockout window', async () => {
      await service.isLockedOut('u1');

      const query = failedLoginAttempts.count.mock.calls[0][0];
      expect(query.where.userId).toBe('u1');
      expect(query.where.attemptedAt.type).toBe('moreThan');
    });
  });

  describe('clearFailedAttempts', () => {
    it('deletes all recorded attempts for the user', async () => {
      await service.clearFailedAttempts('u1');

      expect(failedLoginAttempts.delete).toHaveBeenCalledWith({ userId: 'u1' });
    });
  });
});
