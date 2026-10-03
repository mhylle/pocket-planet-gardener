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

/** Whether the model wrote an entry or the template did (AIB-05). */
export type JournalSource = 'ai' | 'template';

/**
 * One page of the planet's journal (JRN-01): the story of the events logged
 * between coversFrom (exclusive) and coversTo (inclusive). Kept until the
 * planet is deleted.
 */
@Entity('journal_entries')
// The book, newest first (JRN-03 AC1); the migration makes created_at DESC.
@Index(['planetId', 'createdAt'])
export class JournalEntry {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'planet_id', type: 'uuid' })
  planetId!: string;

  @ManyToOne(() => Planet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'planet_id' })
  planet!: Relation<Planet>;

  @Column({ type: 'varchar', length: 2000 })
  text!: string;

  @Column({ type: 'varchar', length: 10 })
  source!: JournalSource;

  @Column({ name: 'covers_from', type: 'timestamptz' })
  coversFrom!: Date;

  @Column({ name: 'covers_to', type: 'timestamptz' })
  coversTo!: Date;

  // No database default: the service stamps it from ClockService.
  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
