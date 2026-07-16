import { z } from 'zod';

export const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  CORS_ORIGIN: z.string().url().default('http://localhost:5173'),

//   DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

//   JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
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