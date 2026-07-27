import 'dotenv/config';
import { join } from 'path';
import { DataSource } from 'typeorm';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  // Verified SSL by default (Neon presents valid certs); DATABASE_SSL=false
  // only for local Postgres without SSL. Keep in sync with app.module.ts.
  ssl: process.env.DATABASE_SSL !== 'false',
  // __dirname-rooted glob works from both src/ (ts-node CLI) and dist/
  // (compiled). A glob, not an explicit list, on purpose: an entity missing
  // from this config makes `migration:generate` emit DROP TABLE for its
  // table — a forgotten manual entry here is a destructive-migration footgun.
  entities: [join(__dirname, '**', '*.entity.{ts,js}')],
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
  synchronize: false,
});
