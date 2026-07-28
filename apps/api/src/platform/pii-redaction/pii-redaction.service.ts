import { createHmac } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { SecretsService } from '@platform/secrets/secrets.service';
import { PII_REDACTION_MODULE_CONFIG, PiiRedactionModuleConfig } from './pii-redaction.config';

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_PATTERN = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
const CREDIT_CARD_PATTERN = /\b(?:\d[ -]?){13,16}\b/g;

const BUILT_IN_PATTERNS = [EMAIL_PATTERN, PHONE_PATTERN, CREDIT_CARD_PATTERN];

@Injectable()
export class PiiRedactionService {
  private readonly hmacKey: string;
  private readonly patterns: RegExp[];

  constructor(
    private readonly secretsService: SecretsService,
    @Inject(PII_REDACTION_MODULE_CONFIG)
    private readonly config: PiiRedactionModuleConfig,
  ) {
    this.hmacKey = this.secretsService.getProviderSecret('piiRedactionKey');
    this.patterns = [...BUILT_IN_PATTERNS, ...(this.config.extraPatterns ?? [])];
  }

  redactText(text: string): string {
    return this.patterns.reduce((result, pattern) => this.applyPattern(result, pattern), text);
  }

  redactObject<T extends object>(obj: T, paths: string[]): T {
    const clone = structuredClone(obj);

    for (const path of paths) {
      this.redactPath(clone, path.split('.'));
    }

    return clone;
  }

  private applyPattern(text: string, pattern: RegExp): string {
    const globalPattern = pattern.global ? pattern : new RegExp(pattern.source, `${pattern.flags}g`);
    return text.replace(globalPattern, (match) => this.tokenize(match));
  }

  private redactPath(target: unknown, segments: string[]): void {
    if (typeof target !== 'object' || target === null) {
      return;
    }

    const [key, ...rest] = segments;
    const record = target as Record<string, unknown>;

    if (!(key in record)) {
      return;
    }

    if (rest.length === 0) {
      const value = record[key];
      if (typeof value === 'string') {
        record[key] = this.tokenize(value);
      }
      return;
    }

    this.redactPath(record[key], rest);
  }

  private tokenize(value: string): string {
    const digest = createHmac('sha256', this.hmacKey).update(value).digest('hex').slice(0, 8);
    return `[REDACTED:${digest}]`;
  }
}
