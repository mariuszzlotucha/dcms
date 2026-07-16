import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import type { AppConfig } from './config/config.schema';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService<AppConfig, true>);

  app.enableCors({ origin: configService.get('CORS_ORIGIN', { infer: true }) });

  await app.listen(configService.get('PORT', { infer: true }));
}

bootstrap();