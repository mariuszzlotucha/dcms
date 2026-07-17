import {
  DynamicModule,
  MiddlewareConsumer,
  Module,
  NestModule,
  Provider,
} from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import {
  SECURITY_MODULE_CONFIG,
  SecurityModuleAsyncOptions,
  SecurityModuleConfig,
} from './security.config';
import { CsrfGuard } from './guards/';
import { StrictValidationPipe } from './pipes/';
import { ValidationRejectionFilter } from './filters';
import { FieldEncryptionService } from './encryption';
import { CorsMiddleware, HelmetMiddleware } from './middleware';

const coreProviders: Provider[] = [
  HelmetMiddleware,
  FieldEncryptionService,
  { provide: APP_PIPE, useClass: StrictValidationPipe },
  { provide: APP_GUARD, useClass: CsrfGuard },
  { provide: APP_FILTER, useClass: ValidationRejectionFilter },
];

@Module({})
export class SecurityModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorsMiddleware, HelmetMiddleware).forRoutes('*');

  }

  static forRoot(config: SecurityModuleConfig): DynamicModule {
    return {
      module: SecurityModule,
      providers: [
        { provide: SECURITY_MODULE_CONFIG, useValue: config },
        ...coreProviders,
      ],
      exports: [SECURITY_MODULE_CONFIG, FieldEncryptionService],
    };
  }

  static forRootAsync(options: SecurityModuleAsyncOptions): DynamicModule {
    return {
      module: SecurityModule,
      imports: options.imports ?? [],
      providers: [
        {
          provide: SECURITY_MODULE_CONFIG,
          useFactory: options.useFactory,
          inject: options.inject ?? [],
        },
        ...coreProviders,
      ],
      exports: [SECURITY_MODULE_CONFIG, FieldEncryptionService],
    };
  }
}
