import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger, RequestMethod } from '@nestjs/common';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppModule } from './app.module';
import type { AppConfig } from './config/config.schema';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(PinoLogger));

  const configService = app.get(ConfigService<AppConfig, true>);

  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'health', method: RequestMethod.GET },
      { path: 'ready', method: RequestMethod.GET },
    ],
  });

  app.enableCors({ origin: configService.get('CORS_ORIGIN', { infer: true }) });
  app.enableShutdownHooks();

  const port = configService.get('PORT', { infer: true });
  await app.listen(port);

  new Logger('Bootstrap').log(
    `DCMS API listening on http://localhost:${port} [${configService.get('NODE_ENV', { infer: true })}]`,
  );
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start DCMS API:', error);
  process.exit(1);
});