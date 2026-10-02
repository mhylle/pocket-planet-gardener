import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { CloudState } from '../simulation/cloud-rules';

/**
 * A player's planet. Under D-0 the planet is also the player: its id is what
 * the browser keeps and sends as X-Planet-Id.
 */
@Entity('planets')
export class Planet {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Typed on another device to open the same planet (ACC-04).
  @Column({ type: 'char', length: 8, unique: true })
  code!: string;

  // Room above the planetNameMax tunable, so raising it needs no migration.
  @Column({ type: 'varchar', length: 64 })
  name!: string;

  @Column({ name: 'radius_level', type: 'int', default: 1 })
  radiusLevel!: number;

  @Column({ name: 'max_plants', type: 'int', default: 60 })
  maxPlants!: number;

  // Bumped by every mutation; a stale expected version is a 409 (D-2).
  @Column({ type: 'int', default: 1 })
  version!: number;

  // The instant the simulation has advanced the planet to (D-1).
  @Column({ name: 'last_simulated_at', type: 'timestamptz' })
  lastSimulatedAt!: Date;

  @Column({ name: 'last_seen_at', type: 'timestamptz' })
  lastSeenAt!: Date;

  // Where the player last dragged the sun, and when; null while it drifts.
  @Column({
    name: 'sun_override_angle',
    type: 'double precision',
    nullable: true,
  })
  sunOverrideAngle!: number | null;

  @Column({ name: 'sun_override_at', type: 'timestamptz', nullable: true })
  sunOverrideAt!: Date | null;

  @Column({ name: 'tutorial_step', type: 'int', default: 0 })
  tutorialStep!: number;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  clouds!: CloudState[];

  @Column({ name: 'arrival_tracking', type: 'jsonb', default: () => "'{}'" })
  arrivalTracking!: Record<string, unknown>;

  @Column({ name: 'reward_counter', type: 'int', default: 0 })
  rewardCounter!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
