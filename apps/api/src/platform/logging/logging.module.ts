import { DynamicModule, Module } from '@nestjs/common';
import { LoggerModule, Params } from 'nestjs-pino';
import { randomUUID } from 'crypto';
import {
  LoggingModuleAsyncOptions,
  LoggingModuleConfig,
} from './logging.config';

function buildPinoHttpOptions(
  config: LoggingModuleConfig,
): Params['pinoHttp'] {
  return {
    level: config.level ?? 'info',
    genReqId: (req, res) => {
      const existing = req.headers['x-request-id'];
      const id = (Array.isArray(existing) ? existing[0] : existing) ?? randomUUID();
      res.setHeader('x-request-id', id);
      return id;
    },
    redact: config.redactPaths ?? ['req.headers.authorization', 'req.headers.cookie'],
    transport: config.prettyPrint
      ? { target: 'pino-pretty', options: { singleLine: true } }
      : undefined,
  };
}

@Module({})
export class LoggingModule {
  static forRoot(config: LoggingModuleConfig = {}): DynamicModule {
    return {
      module: LoggingModule,
      imports: [
        LoggerModule.forRoot({
          pinoHttp: buildPinoHttpOptions(config),
        }),
      ],
      exports: [LoggerModule],
    };
  }

  static forRootAsync(options: LoggingModuleAsyncOptions): DynamicModule {
    return {
      module: LoggingModule,
      imports: [
        LoggerModule.forRootAsync({
          imports: options.imports,
          inject: options.inject ?? [],
          useFactory: async (...args: unknown[]) => {
            const config = await options.useFactory(...args);
            return { pinoHttp: buildPinoHttpOptions(config) };
          },
        }),
      ],
      exports: [LoggerModule],
    };
  }
}