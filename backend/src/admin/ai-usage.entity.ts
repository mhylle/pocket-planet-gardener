import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { Planet } from '../planets/planet.entity';

/**
 * One call of the AI gateway, whether the model answered or a fallback was
 * used. The rows the model answered today count against the daily AI budget
 * (ADM-02, NFR-10).
 */
@Entity('ai_usage')
export class AiUsage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // The AI feature that asked, such as identity or chat.
  @Column({ type: 'varchar', length: 32 })
  feature!: string;

  @Column({ name: 'planet_id', type: 'uuid', nullable: true })
  planetId!: string | null;

  // Set to null when the planet is deleted, so the day's count stays right.
  @ManyToOne(() => Planet, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'planet_id' })
  planet!: Relation<Planet> | null;

  @Column({ name: 'used_fallback', type: 'boolean' })
  usedFallback!: boolean;

  // Why the fallback was used: disabled, budget, timeout, error or invalid.
  @Column({ type: 'varchar', length: 32, nullable: true })
  reason!: string | null;

  @Column({ name: 'latency_ms', type: 'int' })
  latencyMs!: number;

  // Set from ClockService rather than by the database, so the budget's
  // "today" follows the test clock in e2e runs.
  @Index()
  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
