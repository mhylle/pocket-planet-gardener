import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import type { PlantId } from '../content/content.types';
import { Planet } from '../planets/planet.entity';

export type PlantStage = 'seed' | 'sprout' | 'young' | 'bloom';

/** A plant growing at one spot on a planet's surface. */
@Entity('plants')
export class Plant {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'planet_id', type: 'uuid' })
  planetId!: string;

  @ManyToOne(() => Planet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'planet_id' })
  planet!: Relation<Planet>;

  @Column({ type: 'varchar', length: 32 })
  type!: PlantId;

  // Surface position in degrees.
  @Column({ type: 'double precision' })
  lat!: number;

  @Column({ type: 'double precision' })
  lon!: number;

  @Column({ type: 'varchar', length: 16, default: 'seed' })
  stage!: PlantStage;

  // Progress towards bloom, 0..1.
  @Column({ type: 'double precision', default: 0 })
  growth!: number;

  // 0..1.
  @Column({ type: 'double precision', default: 0.5 })
  water!: number;

  // No database default: the service stamps it from ClockService.
  @Column({ name: 'planted_at', type: 'timestamptz' })
  plantedAt!: Date;

  @Column({ name: 'last_harvested_at', type: 'timestamptz', nullable: true })
  lastHarvestedAt!: Date | null;

  @Column({ name: 'harvest_ready', type: 'boolean', default: false })
  harvestReady!: boolean;
}
