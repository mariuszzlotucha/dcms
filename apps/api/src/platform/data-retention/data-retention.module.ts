import { DynamicModule, Injectable, InjectionToken, Module, OptionalFactoryDependency, Provider } from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '@platform/auth/entities/user.entity';
import { Session } from '@platform/sessions/entities/session.entity';
import { DATA_RETENTION_MODULE_CONFIG, DataRetentionModuleConfig } from './data-retention.config';
import { DataRetentionService } from './data-retention.service';

export const USER_ACCOUNT_QUERIES = 'USER_ACCOUNT_QUERIES';

export interface UserAccountQueries {
  findUserIdsInactiveSince(cutoff: Date): Promise<string[]>;
  userExists(userId: string): Promise<boolean>;
  deleteUser(userId: string): Promise<void>;
}

// Default implementation, backed by auth's real User and sessions' real
// Session entities now that both are known. "Inactive" = no Session row
// with createdAt after the cutoff, regardless of that session's later
// revoked/expired status — a session being revoked afterward doesn't erase
// the fact the user was active when it was created.
@Injectable()
class AuthUserAccountQueries implements UserAccountQueries {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Session) private readonly sessions: Repository<Session>,
  ) {}

  async findUserIdsInactiveSince(cutoff: Date): Promise<string[]> {
    const rows = await this.users
      .createQueryBuilder('user')
      .leftJoin(Session, 'session', 'session.userId = user.id AND session.createdAt > :cutoff', { cutoff })
      .where('session.id IS NULL')
      .select('user.id', 'id')
      .getRawMany<{ id: string }>();

    return rows.map((row) => row.id);
  }

  async userExists(userId: string): Promise<boolean> {
    const count = await this.users.count({ where: { id: userId } });
    return count > 0;
  }

  async deleteUser(userId: string): Promise<void> {
    await this.users.delete({ id: userId });
  }
}

interface DataRetentionModuleAsyncOptions {
  useFactory: (...args: unknown[]) => DataRetentionModuleConfig | Promise<DataRetentionModuleConfig>;
  inject?: (InjectionToken | OptionalFactoryDependency)[];
  userAccountQueriesProvider?: Provider;
}

@Module({})
export class DataRetentionModule {
  static forRoot(config: DataRetentionModuleConfig, userAccountQueriesProvider?: Provider): DynamicModule {
    return {
      module: DataRetentionModule,
      imports: [TypeOrmModule.forFeature([User, Session])],
      providers: [
        { provide: DATA_RETENTION_MODULE_CONFIG, useValue: config },
        userAccountQueriesProvider ?? { provide: USER_ACCOUNT_QUERIES, useClass: AuthUserAccountQueries },
        DataRetentionService,
      ],
      exports: [DataRetentionService],
    };
  }

  static forRootAsync(options: DataRetentionModuleAsyncOptions): DynamicModule {
    const configProvider: Provider = {
      provide: DATA_RETENTION_MODULE_CONFIG,
      useFactory: options.useFactory,
      inject: options.inject ?? [],
    };

    return {
      module: DataRetentionModule,
      imports: [TypeOrmModule.forFeature([User, Session])],
      providers: [
        configProvider,
        options.userAccountQueriesProvider ?? { provide: USER_ACCOUNT_QUERIES, useClass: AuthUserAccountQueries },
        DataRetentionService,
      ],
      exports: [DataRetentionService],
    };
  }
}
