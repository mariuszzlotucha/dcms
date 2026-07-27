import { DynamicModule, InjectionToken, Module, OptionalFactoryDependency, Provider } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from './entities/tenant.entity';
import { TenantContextService } from './context/tenant-context.service';
import { TENANTS_MODULE_CONFIG, TenantsModuleConfig } from './tenants.config';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';

interface TenantsModuleAsyncOptions {
  useFactory: (...args: unknown[]) => TenantsModuleConfig | Promise<TenantsModuleConfig>;
  inject?: (InjectionToken | OptionalFactoryDependency)[];
}

@Module({})
export class TenantsModule {
  static forRoot(config: TenantsModuleConfig): DynamicModule {
    return {
      module: TenantsModule,
      imports: [TypeOrmModule.forFeature([Tenant])],
      controllers: [TenantsController],
      providers: [{ provide: TENANTS_MODULE_CONFIG, useValue: config }, TenantsService, TenantContextService],
      exports: [TenantsService, TenantContextService],
    };
  }

  static forRootAsync(options: TenantsModuleAsyncOptions): DynamicModule {
    const configProvider: Provider = {
      provide: TENANTS_MODULE_CONFIG,
      useFactory: options.useFactory,
      inject: options.inject ?? [],
    };

    return {
      module: TenantsModule,
      imports: [TypeOrmModule.forFeature([Tenant])],
      controllers: [TenantsController],
      providers: [configProvider, TenantsService, TenantContextService],
      exports: [TenantsService, TenantContextService],
    };
  }
}
