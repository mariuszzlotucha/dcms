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
import { HelmetMiddleware } from './middleware/helmet.middleware';
import { CsrfGuard } from './guards/csrf.guard';
import { StrictValidationPipe } from './pipes/strict-validation.pipe';
import { ValidationRejectionFilter } from './filters/validation-rejection.filter';
import { FieldEncryptionService } from './encryption/field-encryption.service';

// APP_PIPE / APP_GUARD / APP_FILTER register globally even though they're
// declared inside this module — that's how Nest global providers work,
// so consumers don't have to add the pipe/guard per controller.
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
    // Nest 11 / Express 5: replace '*' with '{*splat}' if '*' stops matching.
    consumer.apply(HelmetMiddleware).forRoutes('*');
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
