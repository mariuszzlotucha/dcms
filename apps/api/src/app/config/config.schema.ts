import { z } from 'zod';

export const configSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  // Comma-separated list of allowed origins, each a valid URL.
  CORS_ORIGIN: z
    .string()
    .default('http://localhost:5173')
    .transform((v) =>
      v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().url()).min(1)),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  // 'false' only for local Postgres without SSL; anything else = verified SSL.
  DATABASE_SSL: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  // Canonical base64 of exactly 32 random bytes — the roundtrip check
  // rejects "a 44-character word" style low-entropy values that a plain
  // length check would accept. Generate with:
  //   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
  FIELD_ENCRYPTION_KEY: z.string().refine((v) => {
    try {
      const bytes = Buffer.from(v, 'base64');
      return bytes.length === 32 && bytes.toString('base64') === v;
    } catch {
      return false;
    }
  }, 'FIELD_ENCRYPTION_KEY must be 32 random bytes encoded as base64'),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // Added for file-storage's S3-compatible object storage.
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ENDPOINT: z.string().url().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),

  // Added for notifications' Resend email provider.
  RESEND_API_KEY: z.string().optional(),

  // Added for billing's Stripe Checkout plan wiring.
  STRIPE_PRICE_STARTER: z.string().optional(),
  STRIPE_PRICE_PRO: z.string().optional(),
  BILLING_SUCCESS_URL: z.string().url().optional(),
  BILLING_CANCEL_URL: z.string().url().optional(),

  // Added for pii-redaction's HMAC tokenization key.
  PII_REDACTION_KEY: z.string().optional(),
});

export type AppConfig = z.infer<typeof configSchema>;

export function validateConfig(rawConfig: Record<string, unknown>): AppConfig {
  const result = configSchema.safeParse(rawConfig);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  return result.data;
}
