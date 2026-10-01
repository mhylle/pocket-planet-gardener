import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** Who wrote a message: the person chatting, or the AI answering. */
export type MessageRole = 'user' | 'assistant';

@Entity('messages')
export class Message {
  // Sequential, so the conversation keeps its order even when a question and
  // its answer are saved with the same timestamp.
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 16 })
  role!: MessageRole;

  @Column({ type: 'text' })
  text!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
