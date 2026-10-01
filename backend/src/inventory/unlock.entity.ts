import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  type Relation,
} from 'typeorm';
import type { DecorationId, PlantId } from '../content/content.types';
import { Planet } from '../planets/planet.entity';

/** A seed or decoration type a planet has unlocked in its catalogue. */
@Entity('unlocks')
export class Unlock {
  // Leads the composite primary key, which therefore indexes it.
  @PrimaryColumn({ name: 'planet_id', type: 'uuid' })
  planetId!: string;

  @PrimaryColumn({ name: 'item_type', type: 'varchar', length: 32 })
  itemType!: PlantId | DecorationId;

  @ManyToOne(() => Planet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'planet_id' })
  planet!: Relation<Planet>;

  @Column({ name: 'unlocked_at', type: 'timestamptz' })
  unlockedAt!: Date;
}
