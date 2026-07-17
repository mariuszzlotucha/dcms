import { DynamicModule, Module, Provider } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AUTH_MODULE_CONFIG,
  AuthModuleAsyncOptions,
  AuthModuleConfig,
} from './auth.config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { User } from './entities/user.entity';
import { GoogleStrategy } from './strategies/google.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LinkedInStrategy } from './strategies/linkedin.strategy';

// JwtModule deliberately registered without options — the signing key comes
// from SecretsService and is passed explicitly at sign/verify time.
const coreImports = [
  TypeOrmModule.forFeature([User]),
  PassportModule.register({ session: false }),
  JwtModule.register({}),
];

const coreProviders: Provider[] = [
  AuthService,
  JwtStrategy,
  GoogleStrategy,
  LinkedInStrategy,
];

@Module({})
export class AuthModule {
  static forRoot(config: AuthModuleConfig): DynamicModule {
    return {
      module: AuthModule,
      imports: coreImports,
      controllers: [AuthController],
      providers: [
        { provide: AUTH_MODULE_CONFIG, useValue: config },
        ...coreProviders,
      ],
      exports: [AuthService],
    };
  }

  static forRootAsync(options: AuthModuleAsyncOptions): DynamicModule {
    return {
      module: AuthModule,
      imports: [...(options.imports ?? []), ...coreImports],
      controllers: [AuthController],
      providers: [
        {
          provide: AUTH_MODULE_CONFIG,
          useFactory: options.useFactory,
          inject: options.inject ?? [],
        },
        ...coreProviders,
      ],
      exports: [AuthService],
    };
  }
}
