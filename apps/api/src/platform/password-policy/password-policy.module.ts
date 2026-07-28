import { DynamicModule, InjectionToken, Module, OptionalFactoryDependency, Provider } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PASSWORD_POLICY_MODULE_CONFIG, PasswordPolicyModuleConfig } from './password-policy.config';
import { FailedLoginAttempt, PasswordPolicyService } from './password-policy.service';

interface PasswordPolicyModuleAsyncOptions {
  useFactory: (...args: unknown[]) => PasswordPolicyModuleConfig | Promise<PasswordPolicyModuleConfig>;
  inject?: (InjectionToken | OptionalFactoryDependency)[];
}

@Module({})
export class PasswordPolicyModule {
  static forRoot(config: PasswordPolicyModuleConfig): DynamicModule {
    return {
      module: PasswordPolicyModule,
      global: true,
      imports: [TypeOrmModule.forFeature([FailedLoginAttempt])],
      providers: [{ provide: PASSWORD_POLICY_MODULE_CONFIG, useValue: config }, PasswordPolicyService],
      exports: [PasswordPolicyService],
    };
  }

  static forRootAsync(options: PasswordPolicyModuleAsyncOptions): DynamicModule {
    const configProvider: Provider = {
      provide: PASSWORD_POLICY_MODULE_CONFIG,
      useFactory: options.useFactory,
      inject: options.inject ?? [],
    };

    return {
      module: PasswordPolicyModule,
      global: true,
      imports: [TypeOrmModule.forFeature([FailedLoginAttempt])],
      providers: [configProvider, PasswordPolicyService],
      exports: [PasswordPolicyService],
    };
  }
}
