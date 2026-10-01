import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import type { DecorationId } from '../content/content.types';
import { Planet } from '../planets/planet.entity';

/** A decoration placed at one spot on a planet's surface. */
@Entity('decorations')
export class Decoration {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'planet_id', type: 'uuid' })
  planetId!: string;

  @ManyToOne(() => Planet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'planet_id' })
  planet!: Relation<Planet>;

  @Column({ type: 'varchar', length: 32 })
  type!: DecorationId;

  // Surface position in degrees.
  @Column({ type: 'double precision' })
  lat!: number;

  @Column({ type: 'double precision' })
  lon!: number;

  @Column({ name: 'placed_at', type: 'timestamptz' })
  placedAt!: Date;
}
