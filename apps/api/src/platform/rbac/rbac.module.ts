import { DynamicModule, InjectionToken, Module, OptionalFactoryDependency, Provider } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoleAssignment } from './entities/role-assignment.entity';
import { RBAC_MODULE_CONFIG, RbacModuleConfig } from './rbac.config';
import { RbacService } from './rbac.service';

interface RbacModuleAsyncOptions {
  useFactory: (...args: unknown[]) => RbacModuleConfig | Promise<RbacModuleConfig>;
  inject?: (InjectionToken | OptionalFactoryDependency)[];
}

@Module({})
export class RbacModule {
  static forRoot(config: RbacModuleConfig): DynamicModule {
    return {
      module: RbacModule,
      global: true,
      imports: [TypeOrmModule.forFeature([RoleAssignment])],
      providers: [{ provide: RBAC_MODULE_CONFIG, useValue: config }, RbacService],
      exports: [RbacService],
    };
  }

  static forRootAsync(options: RbacModuleAsyncOptions): DynamicModule {
    const configProvider: Provider = {
      provide: RBAC_MODULE_CONFIG,
      useFactory: options.useFactory,
      inject: options.inject ?? [],
    };

    return {
      module: RbacModule,
      global: true,
      imports: [TypeOrmModule.forFeature([RoleAssignment])],
      providers: [configProvider, RbacService],
      exports: [RbacService],
    };
  }
}
