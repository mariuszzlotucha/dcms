import { createHmac } from 'crypto';
import { SecretsService } from '@platform/secrets/secrets.service';
import { PiiRedactionService } from './pii-redaction.service';
import { PiiRedactionModuleConfig } from './pii-redaction.config';

describe('PiiRedactionService', () => {
  let secretsService: { getProviderSecret: jest.Mock };
  let service: PiiRedactionService;

  const config: PiiRedactionModuleConfig = {};
  const tokenFor = (value: string) =>
    `[REDACTED:${createHmac('sha256', 'redaction-key').update(value).digest('hex').slice(0, 8)}]`;

  beforeEach(() => {
    secretsService = { getProviderSecret: jest.fn().mockReturnValue('redaction-key') };
    service = new PiiRedactionService(secretsService as unknown as SecretsService, config);
  });

  it('requests the piiRedactionKey secret at construction', () => {
    expect(secretsService.getProviderSecret).toHaveBeenCalledWith('piiRedactionKey');
  });

  describe('redactText', () => {
    it('redacts an email address', () => {
      const result = service.redactText('Contact us at jane.doe@example.com for details.');

      expect(result).toBe(`Contact us at ${tokenFor('jane.doe@example.com')} for details.`);
    });

    it('redacts a phone number', () => {
      const result = service.redactText('Call 555-123-4567 now.');

      expect(result).toBe(`Call ${tokenFor('555-123-4567')} now.`);
    });

    it('redacts a credit card number', () => {
      const result = service.redactText('Card: 4111 1111 1111 1111.');

      expect(result).toContain('[REDACTED:');
      expect(result).not.toContain('4111 1111 1111 1111');
    });

    it('produces the same token for the same value every time (deterministic, not random)', () => {
      const first = service.redactText('jane.doe@example.com');
      const second = service.redactText('jane.doe@example.com');

      expect(first).toBe(second);
    });

    it('produces different tokens for different values', () => {
      const first = service.redactText('jane.doe@example.com');
      const second = service.redactText('john.smith@example.com');

      expect(first).not.toBe(second);
    });

    it('redacts multiple matches of different kinds in the same text', () => {
      const result = service.redactText('Email jane@example.com or call 555-123-4567.');

      expect(result).not.toContain('jane@example.com');
      expect(result).not.toContain('555-123-4567');
    });

    it('leaves text with no PII untouched', () => {
      expect(service.redactText('Contract status changed to approved.')).toBe(
        'Contract status changed to approved.',
      );
    });

    it('applies extra configured patterns in addition to the built-in ones', () => {
      const ssnConfig: PiiRedactionModuleConfig = { extraPatterns: [/\b\d{3}-\d{2}-\d{4}\b/] };
      const ssnService = new PiiRedactionService(secretsService as unknown as SecretsService, ssnConfig);

      const result = ssnService.redactText('SSN: 123-45-6789');

      expect(result).not.toContain('123-45-6789');
    });

    it('handles a non-global extra pattern correctly across multiple matches', () => {
      const nonGlobalConfig: PiiRedactionModuleConfig = { extraPatterns: [/CODE-\d+/] };
      const codeService = new PiiRedactionService(secretsService as unknown as SecretsService, nonGlobalConfig);

      const result = codeService.redactText('CODE-111 and CODE-222');

      expect(result).not.toContain('CODE-111');
      expect(result).not.toContain('CODE-222');
    });
  });

  describe('redactObject', () => {
    it('redacts a top-level string field at the given path', () => {
      const result = service.redactObject({ email: 'jane@example.com', name: 'Jane' }, ['email']);

      expect(result.email).toBe(tokenFor('jane@example.com'));
      expect(result.name).toBe('Jane');
    });

    it('redacts a nested field via a dotted path', () => {
      const result = service.redactObject({ contact: { email: 'jane@example.com' } }, ['contact.email']);

      expect(result.contact.email).toBe(tokenFor('jane@example.com'));
    });

    it('does not mutate the original object (works on a clone)', () => {
      const original = { email: 'jane@example.com' };

      service.redactObject(original, ['email']);

      expect(original.email).toBe('jane@example.com');
    });

    it('silently ignores a path that does not exist on the object', () => {
      const result = service.redactObject({ name: 'Jane' } as { name: string; email?: string }, ['email']);

      expect(result).toEqual({ name: 'Jane' });
    });

    it('leaves a non-string value at the path untouched', () => {
      const result = service.redactObject({ age: 30 }, ['age']);

      expect(result.age).toBe(30);
    });

    it('redacts multiple independent paths in one call', () => {
      const result = service.redactObject({ email: 'jane@example.com', phone: '555-123-4567' }, [
        'email',
        'phone',
      ]);

      expect(result.email).not.toBe('jane@example.com');
      expect(result.phone).not.toBe('555-123-4567');
    });
  });
});
