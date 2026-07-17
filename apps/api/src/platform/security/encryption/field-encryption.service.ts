import { Inject, Injectable } from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from 'crypto';
import {
  SECURITY_MODULE_CONFIG,
  SecurityModuleConfig,
} from '../security.config';
import { getEncryptedFields } from './field-encryption.decorator';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // recommended IV size for GCM
const VERSION = 'v1';

/**
 * Field-level encryption for particularly sensitive entity fields.
 * AES-256-GCM (authenticated encryption) via built-in Node crypto.
 *
 * Payload format: "v1.<iv b64>.<authTag b64>.<ciphertext b64>".
 * The version prefix exists so a future key rotation / algorithm change
 * (owned by `secrets`, not this module) can decrypt old payloads.
 */
@Injectable()
export class FieldEncryptionService {
  private readonly key?: Buffer;

  constructor(@Inject(SECURITY_MODULE_CONFIG) config: SecurityModuleConfig) {
    if (config.encryption?.masterKey) {
      // HKDF, not a bare hash: proper KDF with domain separation (the same
      // master key can safely derive other keys later with different info).
      // NOTE: HKDF does not stretch low-entropy inputs — masterKey MUST be
      // a high-entropy random value (e.g. 32+ bytes from a CSPRNG), which
      // config.schema.ts should enforce (min length). Rotation/key-ring is
      // still `secrets`' future job; the v1 payload prefix is the hook for it.
      this.key = Buffer.from(
        hkdfSync(
          'sha256',
          config.encryption.masterKey,
          'platform-field-encryption',
          'aes-256-gcm-v1',
          32,
        ),
      );
    }
  }

  encrypt(plaintext: string): string {
    const key = this.requireKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return [
      VERSION,
      iv.toString('base64'),
      authTag.toString('base64'),
      ciphertext.toString('base64'),
    ].join('.');
  }

  decrypt(payload: string): string {
    const key = this.requireKey();
    const [version, ivB64, tagB64, dataB64] = payload.split('.');

    if (version !== VERSION || !ivB64 || !tagB64 || !dataB64) {
      throw new Error('Invalid encrypted payload format');
    }

    const decipher = createDecipheriv(
      ALGORITHM,
      key,
      Buffer.from(ivB64, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));

    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }

  /** Encrypts (in place) every property marked with @EncryptedField(). */
  encryptFields<T extends object>(entity: T): T {
    for (const field of getEncryptedFields(entity)) {
      const value = (entity as Record<string | symbol, unknown>)[field];
      if (typeof value === 'string' && value.length > 0) {
        (entity as Record<string | symbol, unknown>)[field] =
          this.encrypt(value);
      }
    }
    return entity;
  }

  /** Decrypts (in place) every property marked with @EncryptedField(). */
  decryptFields<T extends object>(entity: T): T {
    for (const field of getEncryptedFields(entity)) {
      const value = (entity as Record<string | symbol, unknown>)[field];
      if (typeof value === 'string' && value.startsWith(`${VERSION}.`)) {
        (entity as Record<string | symbol, unknown>)[field] =
          this.decrypt(value);
      }
    }
    return entity;
  }

  private requireKey(): Buffer {
    if (!this.key) {
      throw new Error(
        'Field encryption is not configured — provide encryption.masterKey in SecurityModuleConfig',
      );
    }
    return this.key;
  }
}
