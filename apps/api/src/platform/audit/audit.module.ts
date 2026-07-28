import { DynamicModule, Injectable, InjectionToken, Module, OptionalFactoryDependency, Provider } from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditEntry } from './entities/audit-entry.entity';
import { AUDIT_MODULE_CONFIG, AuditModuleConfig } from './audit.config';
import { AuditListener } from './audit.listener';

export interface AuditQueryFilters {
  tenantId?: string;
  eventName?: string;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
}

export interface AuditQueryResult {
  entries: AuditEntry[];
  total: number;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditEntry)
    private readonly auditEntries: Repository<AuditEntry>,
  ) {}

  // AUDIT_ENTRY_CREATED exists in PlatformEventPayloadMap but is deliberately never
  // emitted here — this service's own writes are captured by the same wildcard
  // listener that feeds it, so emitting would recurse into itself.
  async record(eventName: string, actorId: string | null, tenantId: string | null, payload: unknown): Promise<AuditEntry> {
    return this.auditEntries.save(
      this.auditEntries.create({ eventName, actorId, tenantId, payload, timestamp: new Date() }),
    );
  }

  async query(filters: AuditQueryFilters): Promise<AuditQueryResult> {
    const qb = this.auditEntries.createQueryBuilder('entry');

    if (filters.tenantId) {
      qb.andWhere('entry.tenantId = :tenantId', { tenantId: filters.tenantId });
    }
    if (filters.eventName) {
      qb.andWhere('entry.eventName = :eventName', { eventName: filters.eventName });
    }
    if (filters.from) {
      qb.andWhere('entry.timestamp >= :from', { from: filters.from });
    }
    if (filters.to) {
      qb.andWhere('entry.timestamp <= :to', { to: filters.to });
    }

    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 50;

    qb.orderBy('entry.timestamp', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [entries, total] = await qb.getManyAndCount();
    return { entries, total };
  }
}

interface AuditModuleAsyncOptions {
  useFactory: (...args: unknown[]) => AuditModuleConfig | Promise<AuditModuleConfig>;
  inject?: (InjectionToken | OptionalFactoryDependency)[];
}

@Module({})
export class AuditModule {
  static forRoot(config: AuditModuleConfig): DynamicModule {
    return {
      module: AuditModule,
      global: true,
      imports: [TypeOrmModule.forFeature([AuditEntry])],
      providers: [{ provide: AUDIT_MODULE_CONFIG, useValue: config }, AuditService, AuditListener],
      exports: [AuditService],
    };
  }

  static forRootAsync(options: AuditModuleAsyncOptions): DynamicModule {
    const configProvider: Provider = {
      provide: AUDIT_MODULE_CONFIG,
      useFactory: options.useFactory,
      inject: options.inject ?? [],
    };

    return {
      module: AuditModule,
      global: true,
      imports: [TypeOrmModule.forFeature([AuditEntry])],
      providers: [configProvider, AuditService, AuditListener],
      exports: [AuditService],
    };
  }
}
