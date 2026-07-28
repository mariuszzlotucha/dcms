import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';
import { validateConfig } from './config/config.schema';
import type { AppConfig } from './config/config.schema';
import { HealthModule } from '@platform/health/health.module';
import { LoggingModule } from '@platform/logging/logging.module';
import { SecretsModule } from '@platform/secrets/secrets.module';
import { SecretsService } from '@platform/secrets/secrets.service';
import { SecurityModule } from '@platform/security/security.module';
import { AuthModule } from '@platform/auth/auth.module';
import { SessionsModule } from '@platform/sessions';
import { RbacModule } from '@platform/rbac';
import { TenantsModule } from '@platform/tenants';
import { ApiKeysModule } from '@platform/api-keys';
import { RateLimitingModule } from '@platform/rate-limiting';
import { IdempotencyModule } from '@platform/idempotency';
import { FileStorageModule } from '@platform/file-storage';
import { NotificationsModule } from '@platform/notifications';
import { ConsentModule } from '@platform/consent';
import { WebhooksInboundModule } from '@platform/webhooks-inbound';
import { BillingModule } from '@platform/billing';
import { UsageMeteringModule } from '@platform/usage-metering';
import { FeatureFlagsModule } from '@platform/feature-flags';
import { CircuitBreakerModule } from '@platform/circuit-breaker';
import { DeadLetterQueueModule } from '@platform/dead-letter-queue';
import { WebhooksModule } from '@platform/webhooks';
import { ObservabilityModule } from '@platform/observability';
import { ScheduleModule } from '@nestjs/schedule';
import { SchedulerModule } from '@platform/scheduler';
import { AuditModule } from '@platform/audit';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateConfig }),
    EventEmitterModule.forRoot(),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig, true>) => ({
        type: 'postgres',
        url: configService.get('DATABASE_URL', { infer: true }),
        // Verified SSL by default; DATABASE_SSL=false only for local
        // Postgres without SSL. Never rejectUnauthorized: false — that
        // leaves the connection open to MITM.
        ssl: configService.get('DATABASE_SSL', { infer: true }),
        autoLoadEntities: true,
        synchronize: false,
      }),
    }),

    LoggingModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig, true>) => {
        const isProd =
          configService.get('NODE_ENV', { infer: true }) === 'production';
        return { level: isProd ? 'info' : 'debug', prettyPrint: !isProd };
      },
    }),
    HealthModule.forRoot(),
    SecretsModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig, true>) => {
        const stripeKey = configService.get('STRIPE_SECRET_KEY', {
          infer: true,
        });
        const s3AccessKeyId = configService.get('S3_ACCESS_KEY_ID', {
          infer: true,
        });
        const s3SecretAccessKey = configService.get('S3_SECRET_ACCESS_KEY', {
          infer: true,
        });
        const resendKey = configService.get('RESEND_API_KEY', {
          infer: true,
        });
        const stripeWebhookSecret = configService.get('STRIPE_WEBHOOK_SECRET', { infer: true });

        return {
          jwtSigningKey: configService.get('JWT_SECRET', { infer: true }),
          // Separate env vars on purpose: rotating JWT_SECRET is cheap
          // (users re-login), rotating the encryption key means migrating
          // every encrypted row — they must never be coupled.
          encryptionMasterKey: configService.get('FIELD_ENCRYPTION_KEY', {
            infer: true,
          }),
          // Absent key = absent entry, so getProviderSecret('stripe')
          // fails with "not configured" by design, not via an empty string.
          providers: {
            ...(stripeKey ? { stripe: stripeKey } : {}),
            ...(s3AccessKeyId ? { s3AccessKeyId } : {}),
            ...(s3SecretAccessKey ? { s3SecretAccessKey } : {}),
            ...(resendKey ? { resend: resendKey } : {}),
            ...(stripeWebhookSecret ? { stripeWebhookSecret } : {}),
          },
        };
      },
    }),
    SecurityModule.forRootAsync({
      inject: [SecretsService, ConfigService],
      useFactory: (
        secretsService: SecretsService,
        configService: ConfigService<AppConfig, true>,
      ) => ({
        // CORS_ORIGIN is a zod-validated, comma-separated list — already a
        // string[] after the schema transform.
        cors: {
          allowedOrigins: configService.get('CORS_ORIGIN', { infer: true }),
        },
        csrf: { enabled: false },
        encryption: { masterKey: secretsService.getEncryptionMasterKey() },
      }),
    }),
    // NOTE for OAuth setup: with the global 'api' prefix, callback URLs
    // registered in Google/LinkedIn consoles must include it, e.g.
    // https://<host>/api/auth/google/callback — otherwise the provider
    // rejects with redirect_uri_mismatch.
    AuthModule.forRoot({
      jwtExpiresIn: '15m',
    }),
    SessionsModule.forRoot({
      refreshTokenExpiresIn: '30d',
      accessTokenExpiresIn: '15m', // keep in sync with AuthModule's jwtExpiresIn
    }),
    RbacModule.forRoot({
      defaultRole: 'member',
    }),
    TenantsModule.forRoot({
      defaultPlan: 'free',
    }),
    ApiKeysModule.forRoot({
      keyPrefix: 'dcms_live_',
    }),
    RateLimitingModule.forRoot({
      ttlMs: 60_000,
      limit: 100,
    }),
    IdempotencyModule.forRoot({ recordTtlHours: 24 }),
    FileStorageModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig, true>) => ({
        bucket: configService.get('S3_BUCKET', { infer: true }),
        region: configService.get('S3_REGION', { infer: true }),
        endpoint: configService.get('S3_ENDPOINT', { infer: true }),
        maxSizeBytes: 25 * 1024 * 1024,
      }),
    }),
    NotificationsModule.forRoot({
      fromAddress: 'DCMS <noreply@dcms.app>',
    }),
    ConsentModule.forRoot({
      currentVersions: {
        terms_of_service: '2026-01-15',
        marketing_emails: '2026-01-15',
        data_processing: '2026-01-15',
      },
    }),
    WebhooksInboundModule,
    BillingModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig, true>) => ({
        plans: {
          starter: { stripePriceId: configService.get('STRIPE_PRICE_STARTER', { infer: true }), name: 'Starter' },
          pro: { stripePriceId: configService.get('STRIPE_PRICE_PRO', { infer: true }), name: 'Pro' },
        },
        successUrl: configService.get('BILLING_SUCCESS_URL', { infer: true }),
        cancelUrl: configService.get('BILLING_CANCEL_URL', { infer: true }),
      }),
    }),

    UsageMeteringModule.forRoot({
      limitsByPlan: {
        starter: { 'contracts.create': 10 },
        pro: { 'contracts.create': 200 },
      },
    }),
    FeatureFlagsModule.forRoot({
      defaultFlags: {
        beta_dashboard: false,
      },
    }),
    CircuitBreakerModule.forRoot({
      defaults: {
        timeoutMs: 10_000,
        errorThresholdPercentage: 50,
        resetTimeoutMs: 30_000,
      },
      overrides: {
        stripe: { timeoutMs: 15_000 },
      },
    }),
    DeadLetterQueueModule,
    WebhooksModule,
    ObservabilityModule,
    ScheduleModule.forRoot(),
    SchedulerModule.forRoot({
      idempotencyCleanupCron: '0 3 * * *',
      secretsRotationCron: '0 4 1 * *',
    }),
    AuditModule.forRoot({
      excludedEvents: [],
    }),
  ],
})
export class AppModule { }
