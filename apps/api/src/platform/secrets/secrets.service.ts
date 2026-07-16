import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PLATFORM_EVENTS, PlatformEventPayloadMap } from '../events';
import {
  SECRETS_MODULE_CONFIG,
  SecretsModuleConfig,
} from './secrets.config';

@Injectable()
export class SecretsService {
  constructor(
    @Inject(SECRETS_MODULE_CONFIG)
    private readonly config: SecretsModuleConfig,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  getJwtSigningKey(): string {
    return this.config.jwtSigningKey;
  }

  getEncryptionMasterKey(): string {
    return this.config.encryptionMasterKey;
  }

  getProviderSecret(name: string): string {
    const secret = this.config.providers?.[name];
    if (!secret) {
      // Never include the secret value in errors — the name is safe to log.
      throw new Error(`Provider secret "${name}" is not configured`);
    }
    return secret;
  }

  /**
   * No-op placeholder: emits SECRETS_ROTATED so consumers can already
   * subscribe, but no key material is actually swapped yet. Becomes real
   * with scheduler (Phase 3) or the CLI `secrets rotate` command.
   */
  rotate(secretName: string): void {
    const event = {
      secretName,
      rotatedAt: new Date(),
    };
    this.eventEmitter.emit(PLATFORM_EVENTS.SECRETS_ROTATED, event satisfies PlatformEventPayloadMap[typeof PLATFORM_EVENTS.SECRETS_ROTATED]);
  }
}
