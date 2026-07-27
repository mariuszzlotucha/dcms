import { DynamicModule, Module, Provider } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../auth/entities/user.entity';
import {
  SESSIONS_MODULE_CONFIG,
  SessionsModuleAsyncOptions,
  SessionsModuleConfig,
} from './sessions.config';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';
import { Session } from './entities/session.entity';
import { RefreshTokenGuard } from './guards/refresh-token.guard';

const coreImports = [
  TypeOrmModule.forFeature([Session, User]),
  JwtModule.register({}),
];

const coreProviders: Provider[] = [SessionsService, RefreshTokenGuard];

@Module({})
export class SessionsModule {
  static forRoot(config: SessionsModuleConfig): DynamicModule {
    return {
      module: SessionsModule,
      imports: coreImports,
      controllers: [SessionsController],
      providers: [
        { provide: SESSIONS_MODULE_CONFIG, useValue: config },
        ...coreProviders,
      ],
      exports: [SessionsService],
    };
  }

  static forRootAsync(options: SessionsModuleAsyncOptions): DynamicModule {
    return {
      module: SessionsModule,
      imports: [...(options.imports ?? []), ...coreImports],
      controllers: [SessionsController],
      providers: [
        {
          provide: SESSIONS_MODULE_CONFIG,
          useFactory: options.useFactory,
          inject: options.inject ?? [],
        },
        ...coreProviders,
      ],
      exports: [SessionsService],
    };
  }
}
