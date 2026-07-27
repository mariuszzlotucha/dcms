import { DynamicModule, InjectionToken, Module, OptionalFactoryDependency, Provider } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileRecord } from './entities/file.entity';
import { FILE_STORAGE_MODULE_CONFIG, FileStorageModuleConfig } from './file-storage.config';
import { FileStorageService } from './file-storage.service';

interface FileStorageModuleAsyncOptions {
  useFactory: (...args: unknown[]) => FileStorageModuleConfig | Promise<FileStorageModuleConfig>;
  inject?: (InjectionToken | OptionalFactoryDependency)[];
}

@Module({})
export class FileStorageModule {
  static forRoot(config: FileStorageModuleConfig): DynamicModule {
    return {
      module: FileStorageModule,
      global: true,
      imports: [TypeOrmModule.forFeature([FileRecord])],
      providers: [{ provide: FILE_STORAGE_MODULE_CONFIG, useValue: config }, FileStorageService],
      exports: [FileStorageService],
    };
  }

  static forRootAsync(options: FileStorageModuleAsyncOptions): DynamicModule {
    const configProvider: Provider = {
      provide: FILE_STORAGE_MODULE_CONFIG,
      useFactory: options.useFactory,
      inject: options.inject ?? [],
    };

    return {
      module: FileStorageModule,
      global: true,
      imports: [TypeOrmModule.forFeature([FileRecord])],
      providers: [configProvider, FileStorageService],
      exports: [FileStorageService],
    };
  }
}
