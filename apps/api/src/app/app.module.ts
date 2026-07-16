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
        ssl: { rejectUnauthorized: false },
        autoLoadEntities: true,
        synchronize: false,
      }),
    }),

    LoggingModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig, true>) => {
        const isProd = configService.get('NODE_ENV', { infer: true }) === 'production';
        return { level: isProd ? 'info' : 'debug', prettyPrint: !isProd };
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
      inject: [SecretsService],
      useFactory: (secretsService: SecretsService) => ({
        cors: { allowedOrigins: [process.env.CORS_ORIGIN ?? 'http://localhost:5173'] },
        csrf: { enabled: false },
        encryption: { masterKey: secretsService.getEncryptionMasterKey() },
      }),
    }),
    AuthModule.forRoot({
      jwtExpiresIn: '15m',
    }),

  ],
})
export class AppModule {}