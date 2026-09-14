import { DynamicModule, InjectionToken, Module, OptionalFactoryDependency, Provider } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SignatureEnvelope } from './entities/signature-envelope.entity';
import { ESIGNATURE_MODULE_CONFIG, EsignatureModuleConfig } from './esignature.config';
import { EsignatureController } from './esignature.controller';
import { EsignatureListener } from './esignature.listener';
import { EsignatureService } from './esignature.service';
import { DocuSignEsignatureProvider } from './providers/docusign-esignature.provider';

interface EsignatureModuleAsyncOptions {
  useFactory: (...args: unknown[]) => EsignatureModuleConfig | Promise<EsignatureModuleConfig>;
  inject?: (InjectionToken | OptionalFactoryDependency)[];
}

@Module({})
export class EsignatureModule {
  static forRoot(config: EsignatureModuleConfig): DynamicModule {
    return {
      module: EsignatureModule,
      imports: [TypeOrmModule.forFeature([SignatureEnvelope])],
      controllers: [EsignatureController],
      providers: [
        { provide: ESIGNATURE_MODULE_CONFIG, useValue: config },
        EsignatureService,
        EsignatureListener,
        DocuSignEsignatureProvider,
      ],
      exports: [EsignatureService],
    };
  }

  static forRootAsync(options: EsignatureModuleAsyncOptions): DynamicModule {
    const configProvider: Provider = {
      provide: ESIGNATURE_MODULE_CONFIG,
      useFactory: options.useFactory,
      inject: options.inject ?? [],
    };

    return {
      module: EsignatureModule,
      imports: [TypeOrmModule.forFeature([SignatureEnvelope])],
      controllers: [EsignatureController],
      providers: [configProvider, EsignatureService, EsignatureListener, DocuSignEsignatureProvider],
      exports: [EsignatureService],
    };
  }
}
