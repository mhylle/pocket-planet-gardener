import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
  Unique,
} from 'typeorm';
import type { DecorationId, PlantId } from '../content/content.types';
import { Planet } from '../planets/planet.entity';

export type ItemKind = 'seed' | 'decoration';

/** How many of one seed or decoration type a planet holds in its inventory. */
@Entity('inventory_items')
// Also the planet_id index: planet_id is its leading column.
@Unique(['planetId', 'itemType'])
export class InventoryItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'planet_id', type: 'uuid' })
  planetId!: string;

  @ManyToOne(() => Planet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'planet_id' })
  planet!: Relation<Planet>;

  @Column({ name: 'item_type', type: 'varchar', length: 32 })
  itemType!: PlantId | DecorationId;

  @Column({ type: 'varchar', length: 16 })
  kind!: ItemKind;

  @Column({ type: 'int', default: 0 })
  count!: number;
}
