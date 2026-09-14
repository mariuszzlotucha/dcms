import { EventEmitter2 } from '@nestjs/event-emitter';
import { PLATFORM_EVENTS } from '../events';
import { SecretsService } from './secrets.service';
import { SecretsModuleConfig } from './secrets.config';

describe('SecretsService', () => {
  let eventEmitter: { emit: jest.Mock };
  let service: SecretsService;

  const config: SecretsModuleConfig = {
    jwtSigningKey: 'jwt-key',
    encryptionMasterKey: 'encryption-key',
    providers: { stripe: 'sk_test_123' },
  };

  beforeEach(() => {
    eventEmitter = { emit: jest.fn() };
    service = new SecretsService(config, eventEmitter as unknown as EventEmitter2);
  });

  it('returns the configured JWT signing key', () => {
    expect(service.getJwtSigningKey()).toBe('jwt-key');
  });

  it('returns the configured encryption master key', () => {
    expect(service.getEncryptionMasterKey()).toBe('encryption-key');
  });

  it('returns a configured provider secret by name', () => {
    expect(service.getProviderSecret('stripe')).toBe('sk_test_123');
  });

  it('throws for an unconfigured provider secret, without leaking any secret value', () => {
    expect(() => service.getProviderSecret('unknown-provider')).toThrow(
      'Provider secret "unknown-provider" is not configured',
    );
  });

  it('throws when providers is undefined entirely', () => {
    const bareService = new SecretsService(
      { jwtSigningKey: 'k', encryptionMasterKey: 'k' },
      eventEmitter as unknown as EventEmitter2,
    );

    expect(() => bareService.getProviderSecret('stripe')).toThrow('Provider secret "stripe" is not configured');
  });

  it('emits SECRETS_ROTATED with the secret name and a timestamp', () => {
    service.rotate('jwtSigningKey');

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      PLATFORM_EVENTS.SECRETS_ROTATED,
      expect.objectContaining({ secretName: 'jwtSigningKey', rotatedAt: expect.any(Date) }),
    );
  });
});
