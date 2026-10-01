import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { DataSource } from 'typeorm';
import { Planet } from '../planets/planet.entity';
import { ChatSchema1790850718762 } from './migrations/1790850718762-ChatSchema';
import { DropMessages1790859180028 } from './migrations/1790859180028-DropMessages';
import { PlanetSchema1790860588377 } from './migrations/1790860588377-PlanetSchema';

/**
 * The DataSource the TypeORM CLI (migration:generate / migration:run) uses.
 * The application itself never alters the schema: migrations are the only
 * path.
 */
// Read .env without writing it into process.env: Jest hands each test file
// its own copy of process.env, so a loader that mutates it is invisible there.
const fileEnv: NodeJS.Dict<string> = existsSync('.env')
  ? parseEnv(readFileSync('.env', 'utf8'))
  : {};

function env(key: string, fallback: string): string {
  return process.env[key] ?? fileEnv[key] ?? fallback;
}

export const MIGRATIONS = [
  ChatSchema1790850718762,
  DropMessages1790859180028,
  PlanetSchema1790860588377,
];

export default new DataSource({
  type: 'postgres',
  host: env('DB_HOST', 'localhost'),
  port: Number(env('DB_PORT', '5432')),
  username: env('DB_USERNAME', 'postgres'),
  password: env('DB_PASSWORD', 'postgres'),
  database: env('DB_NAME', 'app'),
  entities: [Planet],
  migrations: MIGRATIONS,
  synchronize: false,
});
