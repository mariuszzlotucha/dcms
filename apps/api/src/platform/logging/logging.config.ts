import { ModuleMetadata } from '@nestjs/common';

export interface LoggingModuleConfig {
  level?: 'debug' | 'info' | 'warn' | 'error'; 
  prettyPrint?: boolean; 
  redactPaths?: string[]; 
}

export interface LoggingModuleAsyncOptions
  extends Pick<ModuleMetadata, 'imports'> {
  useFactory: (
    ...args: any[]
  ) => Promise<LoggingModuleConfig> | LoggingModuleConfig;
  inject?: any[];
}
