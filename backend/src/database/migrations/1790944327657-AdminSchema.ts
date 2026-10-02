import { MigrationInterface, QueryRunner } from 'typeorm';

export class AdminSchema1790944327657 implements MigrationInterface {
  name = 'AdminSchema1790944327657';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "admin_settings" ("key" character varying(64) NOT NULL, "value" jsonb NOT NULL, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_183ab1d699c433231a67928c766" PRIMARY KEY ("key"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "ai_usage" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "feature" character varying(32) NOT NULL, "planet_id" uuid, "used_fallback" boolean NOT NULL, "reason" character varying(32), "latency_ms" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_3dddab3a15520a9c3eba859195d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cd4ee478cd9fa126f64df39ed5" ON "ai_usage"  ("created_at") `,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_usage" ADD CONSTRAINT "FK_a3e1aff87aa8e6f80e238ea43ee" FOREIGN KEY ("planet_id") REFERENCES "planets"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ai_usage" DROP CONSTRAINT "FK_a3e1aff87aa8e6f80e238ea43ee"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_cd4ee478cd9fa126f64df39ed5"`,
    );
    await queryRunner.query(`DROP TABLE "ai_usage"`);
    await queryRunner.query(`DROP TABLE "admin_settings"`);
  }
}
