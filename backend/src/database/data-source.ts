import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { DataSource } from 'typeorm';
import { AdminSetting } from '../admin/admin-setting.entity';
import { AiUsage } from '../admin/ai-usage.entity';
import { ChatMessage } from '../chat/chat-message.entity';
import { CreatureMemory } from '../creatures/creature-memory.entity';
import { Creature } from '../creatures/creature.entity';
import { PlanetEvent } from '../events/event.entity';
import { Decoration } from '../garden/decoration.entity';
import { Plant } from '../garden/plant.entity';
import { InventoryItem } from '../inventory/inventory-item.entity';
import { Unlock } from '../inventory/unlock.entity';
import { JournalEntry } from '../journal/journal-entry.entity';
import { Planet } from '../planets/planet.entity';
import { Want } from '../wants/want.entity';
import { ChatSchema1790850718762 } from './migrations/1790850718762-ChatSchema';
import { DropMessages1790859180028 } from './migrations/1790859180028-DropMessages';
import { PlanetSchema1790860588377 } from './migrations/1790860588377-PlanetSchema';
import { GardenSchema1790877455866 } from './migrations/1790877455866-GardenSchema';
import { EventsSchema1790939416415 } from './migrations/1790939416415-EventsSchema';
import { AdminSchema1790944327657 } from './migrations/1790944327657-AdminSchema';
import { CreaturesSchema1790949734700 } from './migrations/1790949734700-CreaturesSchema';
import { WantsSchema1790956158609 } from './migrations/1790956158609-WantsSchema';
import { CreatureChatSchema1790964578421 } from './migrations/1790964578421-CreatureChatSchema';
import { JournalSchema1790967397714 } from './migrations/1790967397714-JournalSchema';

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
  GardenSchema1790877455866,
  EventsSchema1790939416415,
  AdminSchema1790944327657,
  CreaturesSchema1790949734700,
  WantsSchema1790956158609,
  CreatureChatSchema1790964578421,
  JournalSchema1790967397714,
];

export default new DataSource({
  type: 'postgres',
  host: env('DB_HOST', 'localhost'),
  port: Number(env('DB_PORT', '5432')),
  username: env('DB_USERNAME', 'postgres'),
  password: env('DB_PASSWORD', 'postgres'),
  database: env('DB_NAME', 'app'),
  entities: [
    Planet,
    Plant,
    Decoration,
    InventoryItem,
    Unlock,
    PlanetEvent,
    AdminSetting,
    AiUsage,
    Creature,
    Want,
    CreatureMemory,
    ChatMessage,
    JournalEntry,
  ],
  migrations: MIGRATIONS,
  synchronize: false,
});
