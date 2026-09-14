import { FieldEncryptionService } from './field-encryption.service';
import { EncryptedField } from './field-encryption.decorator';
import { SecurityModuleConfig } from '../security.config';

class SensitiveEntity {
  id = 'e1';

  @EncryptedField()
  ssn: string | null = null;

  @EncryptedField()
  taxId: string | null = null;

  plainField = 'not encrypted';
}

describe('FieldEncryptionService', () => {
  const configWithKey: SecurityModuleConfig = {
    cors: { allowedOrigins: [] },
    encryption: { masterKey: 'a-sufficiently-long-random-master-key-value' },
  };

  describe('without a configured masterKey', () => {
    it('throws on encrypt', () => {
      const service = new FieldEncryptionService({ cors: { allowedOrigins: [] } });

      expect(() => service.encrypt('secret')).toThrow(
        'Field encryption is not configured — provide encryption.masterKey in SecurityModuleConfig',
      );
    });

    it('throws on decrypt', () => {
      const service = new FieldEncryptionService({ cors: { allowedOrigins: [] } });

      expect(() => service.decrypt('v1.a.b.c')).toThrow(
        'Field encryption is not configured — provide encryption.masterKey in SecurityModuleConfig',
      );
    });
  });

  describe('encrypt / decrypt roundtrip', () => {
    it('decrypts back to the original plaintext', () => {
      const service = new FieldEncryptionService(configWithKey);

      const ciphertext = service.encrypt('123-45-6789');

      expect(ciphertext).not.toContain('123-45-6789');
      expect(service.decrypt(ciphertext)).toBe('123-45-6789');
    });

    it('produces a payload with the expected "v1.<iv>.<tag>.<data>" shape', () => {
      const service = new FieldEncryptionService(configWithKey);

      const ciphertext = service.encrypt('hello');
      const parts = ciphertext.split('.');

      expect(parts).toHaveLength(4);
      expect(parts[0]).toBe('v1');
    });

    it('produces different ciphertext for the same plaintext on each call (random IV)', () => {
      const service = new FieldEncryptionService(configWithKey);

      expect(service.encrypt('same-value')).not.toBe(service.encrypt('same-value'));
    });

    it('rejects a payload with the wrong version prefix', () => {
      const service = new FieldEncryptionService(configWithKey);
      const ciphertext = service.encrypt('hello');
      const tampered = ciphertext.replace(/^v1\./, 'v2.');

      expect(() => service.decrypt(tampered)).toThrow('Invalid encrypted payload format');
    });

    it('rejects a malformed payload missing segments', () => {
      const service = new FieldEncryptionService(configWithKey);

      expect(() => service.decrypt('v1.onlyOneSegment')).toThrow(
        'Invalid encrypted payload format',
      );
    });

    it('rejects a payload whose ciphertext has been tampered with (auth tag mismatch)', () => {
      const service = new FieldEncryptionService(configWithKey);
      const ciphertext = service.encrypt('hello');
      const [version, iv, tag, data] = ciphertext.split('.');
      const tamperedData = Buffer.from(data, 'base64');
      tamperedData[0] ^= 0xff;
      const tampered = [version, iv, tag, tamperedData.toString('base64')].join('.');

      expect(() => service.decrypt(tampered)).toThrow();
    });

    it('cannot be decrypted by a service instance built from a different masterKey', () => {
      const service = new FieldEncryptionService(configWithKey);
      const otherService = new FieldEncryptionService({
        cors: { allowedOrigins: [] },
        encryption: { masterKey: 'a-completely-different-master-key-value' },
      });

      const ciphertext = service.encrypt('hello');

      expect(() => otherService.decrypt(ciphertext)).toThrow();
    });
  });

  describe('encryptFields / decryptFields', () => {
    it('encrypts every @EncryptedField() property in place', () => {
      const service = new FieldEncryptionService(configWithKey);
      const entity = new SensitiveEntity();
      entity.ssn = '123-45-6789';
      entity.taxId = '98-7654321';

      service.encryptFields(entity);

      expect(entity.ssn).toMatch(/^v1\./);
      expect(entity.taxId).toMatch(/^v1\./);
      expect(entity.plainField).toBe('not encrypted');
    });

    it('leaves null/empty fields untouched', () => {
      const service = new FieldEncryptionService(configWithKey);
      const entity = new SensitiveEntity();
      entity.ssn = null;
      entity.taxId = '';

      service.encryptFields(entity);

      expect(entity.ssn).toBeNull();
      expect(entity.taxId).toBe('');
    });

    it('is idempotent — encrypting an already-encrypted field does not double-encrypt it', () => {
      const service = new FieldEncryptionService(configWithKey);
      const entity = new SensitiveEntity();
      entity.ssn = '123-45-6789';

      service.encryptFields(entity);
      const firstPass = entity.ssn;
      service.encryptFields(entity);

      expect(entity.ssn).toBe(firstPass);
    });

    it('decrypts every @EncryptedField() property in place', () => {
      const service = new FieldEncryptionService(configWithKey);
      const entity = new SensitiveEntity();
      entity.ssn = '123-45-6789';
      service.encryptFields(entity);

      service.decryptFields(entity);

      expect(entity.ssn).toBe('123-45-6789');
    });

    it('leaves plaintext (non-prefixed) fields untouched on decrypt', () => {
      const service = new FieldEncryptionService(configWithKey);
      const entity = new SensitiveEntity();
      entity.ssn = 'already-plaintext';

      service.decryptFields(entity);

      expect(entity.ssn).toBe('already-plaintext');
    });
  });
});
