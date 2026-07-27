import { DynamicModule, InjectionToken, Module, OptionalFactoryDependency, Provider } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConsentRecord } from './entities/consent-record.entity';
import { CONSENT_MODULE_CONFIG, ConsentModuleConfig } from './consent.config';
import { ConsentService } from './consent.service';

interface ConsentModuleAsyncOptions {
  useFactory: (...args: unknown[]) => ConsentModuleConfig | Promise<ConsentModuleConfig>;
  inject?: (InjectionToken | OptionalFactoryDependency)[];
}

@Module({})
export class ConsentModule {
  static forRoot(config: ConsentModuleConfig): DynamicModule {
    return {
      module: ConsentModule,
      global: true,
      imports: [TypeOrmModule.forFeature([ConsentRecord])],
      providers: [{ provide: CONSENT_MODULE_CONFIG, useValue: config }, ConsentService],
      exports: [ConsentService],
    };
  }

  static forRootAsync(options: ConsentModuleAsyncOptions): DynamicModule {
    const configProvider: Provider = {
      provide: CONSENT_MODULE_CONFIG,
      useFactory: options.useFactory,
      inject: options.inject ?? [],
    };

    return {
      module: ConsentModule,
      global: true,
      imports: [TypeOrmModule.forFeature([ConsentRecord])],
      providers: [configProvider, ConsentService],
      exports: [ConsentService],
    };
  }
}
