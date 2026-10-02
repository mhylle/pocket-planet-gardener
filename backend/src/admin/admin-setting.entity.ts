import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * One game-owner setting, such as aiEnabled, stored under its name so that a
 * new setting needs no migration (ADM-01, ADM-02). A missing row means the
 * default applies.
 */
@Entity('admin_settings')
export class AdminSetting {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  key!: string;

  // Checked when read: AdminSettingsService falls back to the default when
  // the stored value has the wrong type.
  @Column({ type: 'jsonb' })
  value!: unknown;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
