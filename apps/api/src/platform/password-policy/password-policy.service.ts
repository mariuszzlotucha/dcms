import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Column, CreateDateColumn, Entity, MoreThan, PrimaryGeneratedColumn, Repository } from 'typeorm';
import { PLATFORM_EVENTS, PlatformEventPayloadMap } from '../events';
import { PASSWORD_POLICY_MODULE_CONFIG, PasswordPolicyModuleConfig } from './password-policy.config';

@Entity('failed_login_attempts')
export class FailedLoginAttempt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @CreateDateColumn()
  attemptedAt: Date;
}

@Injectable()
export class PasswordPolicyService {
  constructor(
    @InjectRepository(FailedLoginAttempt)
    private readonly failedLoginAttempts: Repository<FailedLoginAttempt>,
    @Inject(PASSWORD_POLICY_MODULE_CONFIG)
    private readonly config: PasswordPolicyModuleConfig,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  validateStrength(password: string): void {
    const problems: string[] = [];

    if (password.length < this.config.minLength) {
      problems.push(`must be at least ${this.config.minLength} characters`);
    }
    if (this.config.requireNumber && !/\d/.test(password)) {
      problems.push('must contain at least one number');
    }
    if (this.config.requireLetter && !/[a-zA-Z]/.test(password)) {
      problems.push('must contain at least one letter');
    }

    if (problems.length > 0) {
      throw new BadRequestException(`Password ${problems.join(', ')}`);
    }
  }

  async recordFailedAttempt(userId: string): Promise<void> {
    await this.failedLoginAttempts.save(this.failedLoginAttempts.create({ userId }));

    const count = await this.countRecentAttempts(userId);

    if (count === this.config.maxFailedAttempts) {
      this.eventEmitter.emit(
        PLATFORM_EVENTS.PASSWORD_LOCKED_OUT,
        { userId, failedAttempts: count } satisfies PlatformEventPayloadMap[typeof PLATFORM_EVENTS.PASSWORD_LOCKED_OUT],
      );
    }
  }

  async isLockedOut(userId: string): Promise<boolean> {
    const count = await this.countRecentAttempts(userId);
    return count >= this.config.maxFailedAttempts;
  }

  async clearFailedAttempts(userId: string): Promise<void> {
    await this.failedLoginAttempts.delete({ userId });
  }

  private async countRecentAttempts(userId: string): Promise<number> {
    const windowStart = new Date(Date.now() - this.config.lockoutDurationMinutes * 60 * 1000);
    return this.failedLoginAttempts.count({ where: { userId, attemptedAt: MoreThan(windowStart) } });
  }
}
