import 'dotenv/config';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { User } from './platform/auth/entities/user.entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  // ssl: true verifies the server certificate (Neon presents valid certs).
  // Keep in sync with the TypeOrmModule options in app.module.ts.
  ssl: true,
  // Explicit imports, not a 'src/**' glob: a glob rooted in src/ silently
  // finds nothing when run from compiled dist/, so migrations generated in
  // prod-like environments would see an empty schema. Add new entities here
  // as they appear.
  entities: [User],
  // __dirname resolves correctly from both src/ (ts-node CLI) and dist/
  // (compiled), and the ts/js alternation covers both file extensions.
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
  synchronize: false,
});
