import { DynamicModule, InjectionToken, Module, OptionalFactoryDependency, Provider } from '@nestjs/common';
import { PII_REDACTION_MODULE_CONFIG, PiiRedactionModuleConfig } from './pii-redaction.config';
import { PiiRedactionService } from './pii-redaction.service';

interface PiiRedactionModuleAsyncOptions {
  useFactory: (...args: unknown[]) => PiiRedactionModuleConfig | Promise<PiiRedactionModuleConfig>;
  inject?: (InjectionToken | OptionalFactoryDependency)[];
}

@Module({})
export class PiiRedactionModule {
  static forRoot(config: PiiRedactionModuleConfig): DynamicModule {
    return {
      module: PiiRedactionModule,
      global: true,
      providers: [{ provide: PII_REDACTION_MODULE_CONFIG, useValue: config }, PiiRedactionService],
      exports: [PiiRedactionService],
    };
  }

  static forRootAsync(options: PiiRedactionModuleAsyncOptions): DynamicModule {
    const configProvider: Provider = {
      provide: PII_REDACTION_MODULE_CONFIG,
      useFactory: options.useFactory,
      inject: options.inject ?? [],
    };

    return {
      module: PiiRedactionModule,
      global: true,
      providers: [configProvider, PiiRedactionService],
      exports: [PiiRedactionService],
    };
  }
}
