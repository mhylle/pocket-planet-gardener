import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { Creature } from './creature.entity';

/** What a memory came from: a chat, a want, a planet event or a story. */
export type MemoryKind = 'chat' | 'want' | 'event' | 'story';

/**
 * One thing a creature remembers (WNT-03 AC2), fed back into its wants and
 * chats. Goes with the creature, and so with its planet.
 */
@Entity('creature_memories')
export class CreatureMemory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'creature_id', type: 'uuid' })
  creatureId!: string;

  @ManyToOne(() => Creature, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'creature_id' })
  creature!: Relation<Creature>;

  @Column({ type: 'varchar', length: 8 })
  kind!: MemoryKind;

  @Column({ type: 'varchar', length: 400 })
  text!: string;

  // No database default: the service stamps it from ClockService.
  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
