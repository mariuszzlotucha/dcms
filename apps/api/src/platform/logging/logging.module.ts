import { DynamicModule, Module } from '@nestjs/common';
import { LoggerModule, Params } from 'nestjs-pino';
import { randomUUID } from 'crypto';
import {
  LoggingModuleAsyncOptions,
  LoggingModuleConfig,
} from './logging.config';

// Always redacted regardless of config: credentials must never reach logs.
// req.body.* entries are inert today (pino-http doesn't log bodies by
// default) but guard the day someone enables body logging.
const DEFAULT_REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.body.password',
  'req.body.token',
];

// Builds the pino-http options shared by forRoot and forRootAsync.
function buildPinoHttpOptions(
  config: LoggingModuleConfig,
): Params['pinoHttp'] {
  return {
    level: config.level ?? 'info',
    // Respects x-request-id coming from a reverse proxy / frontend;
    // falls back to a generated UUID (built-in crypto, no extra dependency).
    genReqId: (req, res) => {
      const existing = req.headers['x-request-id'];
      const id = (Array.isArray(existing) ? existing[0] : existing) ?? randomUUID();
      res.setHeader('x-request-id', id);
      return id;
    },
    // Provisional, lightweight hygiene — NOT the final PII masking
    // mechanism. That's `pii-redaction` in Phase 4.
    redact: [
      ...new Set([...DEFAULT_REDACT_PATHS, ...(config.redactPaths ?? [])]),
    ],
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
          useFactory: async (...args: any[]) => {
            const config = await options.useFactory(...args);
            return { pinoHttp: buildPinoHttpOptions(config) };
          },
        }),
      ],
      exports: [LoggerModule],
    };
  }
}
