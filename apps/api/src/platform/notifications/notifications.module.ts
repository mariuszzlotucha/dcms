import { DynamicModule, InjectionToken, Module, OptionalFactoryDependency, Provider } from '@nestjs/common';
import { NOTIFICATIONS_MODULE_CONFIG, NotificationsModuleConfig } from './notifications.config';
import { NotificationsService } from './notifications.service';

interface NotificationsModuleAsyncOptions {
  useFactory: (...args: unknown[]) => NotificationsModuleConfig | Promise<NotificationsModuleConfig>;
  inject?: (InjectionToken | OptionalFactoryDependency)[];
}

@Module({})
export class NotificationsModule {
  static forRoot(config: NotificationsModuleConfig): DynamicModule {
    return {
      module: NotificationsModule,
      global: true,
      providers: [{ provide: NOTIFICATIONS_MODULE_CONFIG, useValue: config }, NotificationsService],
      exports: [NotificationsService],
    };
  }

  static forRootAsync(options: NotificationsModuleAsyncOptions): DynamicModule {
    const configProvider: Provider = {
      provide: NOTIFICATIONS_MODULE_CONFIG,
      useFactory: options.useFactory,
      inject: options.inject ?? [],
    };

    return {
      module: NotificationsModule,
      global: true,
      providers: [configProvider, NotificationsService],
      exports: [NotificationsService],
    };
  }
}
