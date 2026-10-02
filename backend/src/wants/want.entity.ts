import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { Creature } from '../creatures/creature.entity';
import { Planet } from '../planets/planet.entity';
import type { WantSpec } from './want-evaluator';

/** Wants never expire: only fulfilment or "Maybe later" ends one (WNT-05 AC3). */
export type WantStatus = 'active' | 'fulfilled' | 'dismissed';

export type WantSource = 'ai' | 'fallback';

/**
 * Something a creature asks for (WNT-01..05). Resolved wants are kept, so
 * a creature's history stays with it until its planet is deleted.
 */
@Entity('wants')
// At most one active want per creature (WNT-01 AC2).
@Index(['creatureId'], { unique: true, where: `"status" = 'active'` })
export class Want {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'creature_id', type: 'uuid' })
  creatureId!: string;

  @ManyToOne(() => Creature, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'creature_id' })
  creature!: Relation<Creature>;

  @Index()
  @Column({ name: 'planet_id', type: 'uuid' })
  planetId!: string;

  @ManyToOne(() => Planet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'planet_id' })
  planet!: Relation<Planet>;

  // The condition the game checks (WNT-02 AC3).
  @Column({ type: 'jsonb' })
  spec!: WantSpec;

  // In the creature's own voice (WNT-01 AC3).
  @Column({ type: 'varchar', length: 400 })
  text!: string;

  // Such as "2 moonflowers within 3 steps of the lamp-post" (WNT-02 AC2).
  @Column({ name: 'plain_description', type: 'varchar', length: 200 })
  plainDescription!: string;

  @Column({ type: 'varchar', length: 12, default: 'active' })
  status!: WantStatus;

  @Column({ type: 'varchar', length: 8 })
  source!: WantSource;

  // No database defaults: the service stamps both from ClockService.
  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt!: Date | null;
}
