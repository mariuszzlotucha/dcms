import { ModuleMetadata } from '@nestjs/common';

export interface SecretsModuleConfig {
  jwtSigningKey: string;
  encryptionMasterKey: string;
  providers?: Record<string, string>;
}

export interface SecretsModuleAsyncOptions
  extends Pick<ModuleMetadata, 'imports'> {
  useFactory: (
    ...args: any[]
  ) => Promise<SecretsModuleConfig> | SecretsModuleConfig;
  inject?: any[];
}

export const SECRETS_MODULE_CONFIG = Symbol('SECRETS_MODULE_CONFIG');
