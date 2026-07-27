import { DynamicModule, InjectionToken, Module, OptionalFactoryDependency, Provider } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import Stripe from 'stripe';
import { SecretsService } from '@platform/secrets/secrets.service';
import { Subscription } from './entities/subscription.entity';
import { BILLING_MODULE_CONFIG, BillingModuleConfig } from './billing.config';
import { BillingController } from './billing.controller';
import { BillingListener } from './billing.listener';
import { BillingService } from './billing.service';

export const STRIPE_CLIENT = 'STRIPE_CLIENT';

interface BillingModuleAsyncOptions {
  useFactory: (...args: unknown[]) => BillingModuleConfig | Promise<BillingModuleConfig>;
  inject?: (InjectionToken | OptionalFactoryDependency)[];
}

const stripeClientProvider: Provider = {
  provide: STRIPE_CLIENT,
  useFactory: (secretsService: SecretsService) => new Stripe(secretsService.getProviderSecret('stripe')),
  inject: [SecretsService],
};

@Module({})
export class BillingModule {
  static forRoot(config: BillingModuleConfig): DynamicModule {
    return {
      module: BillingModule,
      imports: [TypeOrmModule.forFeature([Subscription])],
      controllers: [BillingController],
      providers: [
        { provide: BILLING_MODULE_CONFIG, useValue: config },
        stripeClientProvider,
        BillingService,
        BillingListener,
      ],
      exports: [BillingService],
    };
  }

  static forRootAsync(options: BillingModuleAsyncOptions): DynamicModule {
    const configProvider: Provider = {
      provide: BILLING_MODULE_CONFIG,
      useFactory: options.useFactory,
      inject: options.inject ?? [],
    };

    return {
      module: BillingModule,
      imports: [TypeOrmModule.forFeature([Subscription])],
      controllers: [BillingController],
      providers: [configProvider, stripeClientProvider, BillingService, BillingListener],
      exports: [BillingService],
    };
  }
}
