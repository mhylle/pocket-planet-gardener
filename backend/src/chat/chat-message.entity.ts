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

/** Who wrote a chat message: the player, the creature, or the game itself (a wellbeing notice). */
export type ChatRole = 'user' | 'creature' | 'notice';

/** Whether the model, a fallback line or a fixed script wrote a message; null for the player's own. */
export type ChatSource = 'ai' | 'fallback' | 'scripted';

/**
 * One line of a chat between the player and a creature (CHT-01, CHT-04).
 * Kept until the player forgets the chats or deletes the planet (NFR-06).
 */
@Entity('chat_messages')
// History paging, newest first (CHT-04 AC1).
@Index(['creatureId', 'createdAt'])
// Deleting a planet cascades by planet_id. Not the daily count (CHT-03):
// that reads ai_usage, which forgetting the chats leaves alone.
@Index(['planetId', 'role', 'createdAt'])
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'creature_id', type: 'uuid' })
  creatureId!: string;

  @ManyToOne(() => Creature, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'creature_id' })
  creature!: Relation<Creature>;

  @Column({ name: 'planet_id', type: 'uuid' })
  planetId!: string;

  @ManyToOne(() => Planet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'planet_id' })
  planet!: Relation<Planet>;

  @Column({ type: 'varchar', length: 8 })
  role!: ChatRole;

  @Column({ type: 'varchar', length: 1200 })
  text!: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  source!: ChatSource | null;

  // No database default: the service stamps it from ClockService, strictly
  // after the creature's previous message, so a chat reads in order.
  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
