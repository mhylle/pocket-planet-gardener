import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import type { SpeciesId } from '../content/content.types';
import { Planet } from '../planets/planet.entity';
import type { CreatureIdentity, IdentitySource } from './identity.types';

/** Never below content (CRT-04). */
export type CreatureMood = 'content' | 'cheerful' | 'overjoyed';

/** The identity as stored: all of it but the name, which has its own column. */
export type StoredIdentity = Omit<CreatureIdentity, 'name'>;

/**
 * A creature living on a planet (CRT-01, CRT-03). Nothing deletes one but
 * the deletion of its planet (CRT-05).
 */
@Entity('creatures')
export class Creature {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'planet_id', type: 'uuid' })
  planetId!: string;

  @ManyToOne(() => Planet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'planet_id' })
  planet!: Relation<Planet>;

  @Column({ type: 'varchar', length: 16 })
  species!: SpeciesId;

  @Column({ type: 'varchar', length: 40 })
  name!: string;

  // Created once on arrival and never regenerated (CRT-03 AC3, AIB-05 AC2).
  @Column({ type: 'jsonb' })
  identity!: StoredIdentity;

  @Column({ name: 'identity_source', type: 'varchar', length: 8 })
  identitySource!: IdentitySource;

  @Column({ type: 'varchar', length: 12, default: 'content' })
  mood!: CreatureMood;

  // No database default: the service stamps it from ClockService.
  @Column({ name: 'mood_since', type: 'timestamptz' })
  moodSince!: Date;

  // Its arrival condition no longer holds (CRT-04 AC3).
  @Column({ type: 'boolean', default: false })
  wistful!: boolean;

  // Its home spot on the surface, in degrees.
  @Column({ type: 'double precision' })
  lat!: number;

  @Column({ type: 'double precision' })
  lon!: number;

  @Column({ name: 'arrived_at', type: 'timestamptz' })
  arrivedAt!: Date;
}
