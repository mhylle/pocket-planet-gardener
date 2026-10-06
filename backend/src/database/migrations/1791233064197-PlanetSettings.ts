import { MigrationInterface, QueryRunner } from 'typeorm';

export class PlanetSettings1791233064197 implements MigrationInterface {
  name = 'PlanetSettings1791233064197';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "planets" ADD "settings" jsonb NOT NULL DEFAULT '{}'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "planets" DROP COLUMN "settings"`);
  }
}
