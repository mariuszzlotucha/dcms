import { DynamicModule, InjectionToken, Module, OptionalFactoryDependency, Provider } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiKey } from './entities/api-key.entity';
import { ApiKeyGuard } from './guards/api-key.guard';
import { API_KEYS_MODULE_CONFIG, ApiKeysModuleConfig } from './api-keys.config';
import { ApiKeysController } from './api-keys.controller';
import { ApiKeysService } from './api-keys.service';

interface ApiKeysModuleAsyncOptions {
  useFactory: (...args: unknown[]) => ApiKeysModuleConfig | Promise<ApiKeysModuleConfig>;
  inject?: (InjectionToken | OptionalFactoryDependency)[];
}

@Module({})
export class ApiKeysModule {
  static forRoot(config: ApiKeysModuleConfig): DynamicModule {
    return {
      module: ApiKeysModule,
      imports: [TypeOrmModule.forFeature([ApiKey])],
      controllers: [ApiKeysController],
      providers: [{ provide: API_KEYS_MODULE_CONFIG, useValue: config }, ApiKeysService, ApiKeyGuard],
      exports: [ApiKeysService, ApiKeyGuard],
    };
  }

  static forRootAsync(options: ApiKeysModuleAsyncOptions): DynamicModule {
    const configProvider: Provider = {
      provide: API_KEYS_MODULE_CONFIG,
      useFactory: options.useFactory,
      inject: options.inject ?? [],
    };

    return {
      module: ApiKeysModule,
      imports: [TypeOrmModule.forFeature([ApiKey])],
      controllers: [ApiKeysController],
      providers: [configProvider, ApiKeysService, ApiKeyGuard],
      exports: [ApiKeysService, ApiKeyGuard],
    };
  }
}
