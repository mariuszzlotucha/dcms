import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger, RequestMethod } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppModule } from './app.module';
import type { AppConfig } from './config/config.schema';
import {
  createCorsOptions,
  SECURITY_MODULE_CONFIG,
  SecurityModuleConfig,
} from '@platform/security';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(PinoLogger));

  const configService = app.get(ConfigService<AppConfig, true>);

  // Trust exactly one hop (Render's proxy / load balancer): req.ip and
  // req.secure reflect the real client instead of the proxy. Value 1, not
  // true — trusting arbitrary hops would let clients spoof their IP via
  // X-Forwarded-For.
  app.set('trust proxy', 1);

  app.enableCors(
    createCorsOptions(app.get<SecurityModuleConfig>(SECURITY_MODULE_CONFIG)),
  );

  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'health', method: RequestMethod.GET },
      { path: 'ready', method: RequestMethod.GET },
    ],
  });

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
