import { ModuleMetadata } from '@nestjs/common';

export interface AuthModuleConfig {
  jwtExpiresIn: string;
  oauth?: {
    google?: { clientId: string; clientSecret: string; callbackUrl: string };
    linkedin?: { clientId: string; clientSecret: string; callbackUrl: string };
  };
  mfa?: {
    enabled: boolean;
    methods: 'totp'[];
  };
}

export type OauthProviderName = keyof NonNullable<AuthModuleConfig['oauth']>;

export interface AuthModuleAsyncOptions
  extends Pick<ModuleMetadata, 'imports'> {
  useFactory: (
    ...args: any[]
  ) => Promise<AuthModuleConfig> | AuthModuleConfig;
  inject?: any[];
}

export const AUTH_MODULE_CONFIG = Symbol('AUTH_MODULE_CONFIG');
