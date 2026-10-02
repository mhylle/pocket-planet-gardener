import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { Planet } from '../planets/planet.entity';

/**
 * One fact of a mutation, kept in the planet's event log: what the
 * welcome-back summary and, later, the journal are told (TIM-03, JRN-02).
 * Not named Event, so a missing import cannot fall back to the global one.
 */
@Entity('events')
@Index(['planetId', 'occurredAt'])
export class PlanetEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'planet_id', type: 'uuid' })
  planetId!: string;

  @ManyToOne(() => Planet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'planet_id' })
  planet!: Relation<Planet>;

  // A fact type such as plant-bloomed.
  @Column({ type: 'varchar', length: 48 })
  type!: string;

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  // When it happened, which for away-time catch-up lies before created_at.
  @Column({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt!: Date;

  // Marked in the journal so the player can find it (JRN-03 AC2).
  @Column({ name: 'is_milestone', type: 'boolean', default: false })
  isMilestone!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
