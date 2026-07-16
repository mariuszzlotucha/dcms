import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { validateConfig } from './config/config.schema';
import type { AppConfig } from './config/config.schema';
import { HealthModule } from '@platform/health/health.module';
import { LoggingModule } from '@platform/logging/logging.module';
import { SecurityModule } from '@platform/security';
import { SecretsModule } from '@platform/secrets';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateConfig,
    }),
    EventEmitterModule.forRoot(),

    LoggingModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig, true>) => {
        const isProd = configService.get('NODE_ENV', { infer: true }) === 'production';
        return {
          level: isProd ? 'info' : 'debug',
          prettyPrint: !isProd,
        };
      },
    }),
    HealthModule.forRoot(),
    SecretsModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig, true>) => ({
        jwtSigningKey: configService.get('JWT_SECRET', { infer: true }),
        encryptionMasterKey: configService.get('JWT_SECRET', { infer: true }),
        providers: {
          stripe: configService.get('STRIPE_SECRET_KEY', { infer: true }) ?? '',
        },
      }),
    }),
    SecurityModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig, true>) => ({
        cors: { allowedOrigins: [configService.get('CORS_ORIGIN', { infer: true })] },
        csrf: { enabled: false },
        encryption: { masterKey: configService.get('JWT_SECRET', { infer: true }) },
      }),
    }),

  ],
})
export class AppModule { }