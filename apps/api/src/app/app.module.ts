import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { validateConfig } from './config/config.schema';
import type { AppConfig } from './config/config.schema';
import { HealthModule } from '@platform/health/health.module';
import { LoggingModule } from '@platform/logging/logging.module';

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

  ],
})
export class AppModule {}