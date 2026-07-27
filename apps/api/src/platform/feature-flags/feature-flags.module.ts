import { DynamicModule, InjectionToken, Module, OptionalFactoryDependency, Provider } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeatureFlag } from './entities/feature-flag.entity';
import { FEATURE_FLAGS_MODULE_CONFIG, FeatureFlagsModuleConfig } from './feature-flags.config';
import { FeatureFlagsService } from './feature-flags.service';

interface FeatureFlagsModuleAsyncOptions {
  useFactory: (...args: unknown[]) => FeatureFlagsModuleConfig | Promise<FeatureFlagsModuleConfig>;
  inject?: (InjectionToken | OptionalFactoryDependency)[];
}

@Module({})
export class FeatureFlagsModule {
  static forRoot(config: FeatureFlagsModuleConfig): DynamicModule {
    return {
      module: FeatureFlagsModule,
      global: true,
      imports: [TypeOrmModule.forFeature([FeatureFlag])],
      providers: [{ provide: FEATURE_FLAGS_MODULE_CONFIG, useValue: config }, FeatureFlagsService],
      exports: [FeatureFlagsService],
    };
  }

  static forRootAsync(options: FeatureFlagsModuleAsyncOptions): DynamicModule {
    const configProvider: Provider = {
      provide: FEATURE_FLAGS_MODULE_CONFIG,
      useFactory: options.useFactory,
      inject: options.inject ?? [],
    };

    return {
      module: FeatureFlagsModule,
      global: true,
      imports: [TypeOrmModule.forFeature([FeatureFlag])],
      providers: [configProvider, FeatureFlagsService],
      exports: [FeatureFlagsService],
    };
  }
}
