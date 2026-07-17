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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateConfig }),
    EventEmitterModule.forRoot(),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig, true>) => ({
        type: 'postgres',
        url: configService.get('DATABASE_URL', { infer: true }),
        // ssl: true verifies the server certificate (Neon presents valid
        // certs). rejectUnauthorized: false would leave the connection
        // open to MITM — never disable verification to "fix" SSL errors;
        // fix the connection string / CA instead.
        ssl: true,
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
        // CORS_ORIGIN comes through the zod-validated config (single source
        // of the default + .url() validation) — never raw process.env.
        cors: {
          allowedOrigins: [configService.get('CORS_ORIGIN', { infer: true })],
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
  ],
})
export class AppModule {}
