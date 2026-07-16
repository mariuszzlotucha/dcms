import { DynamicModule, Module } from '@nestjs/common';
import {
  SECRETS_MODULE_CONFIG,
  SecretsModuleAsyncOptions,
  SecretsModuleConfig,
} from './secrets.config';
import { SecretsService } from './secrets.service';

// global: true — SecretsService must be injectable in other dynamic
// modules' useFactory (e.g. SecurityModule.forRootAsync in AppModule)
// without each of them re-importing this module.
@Module({})
export class SecretsModule {
  static forRoot(config: SecretsModuleConfig): DynamicModule {
    return {
      module: SecretsModule,
      global: true,
      providers: [
        { provide: SECRETS_MODULE_CONFIG, useValue: config },
        SecretsService,
      ],
      exports: [SecretsService],
    };
  }

  static forRootAsync(options: SecretsModuleAsyncOptions): DynamicModule {
    return {
      module: SecretsModule,
      global: true,
      imports: options.imports ?? [],
      providers: [
        {
          provide: SECRETS_MODULE_CONFIG,
          useFactory: options.useFactory,
          inject: options.inject ?? [],
        },
        SecretsService,
      ],
      exports: [SecretsService],
    };
  }
}
