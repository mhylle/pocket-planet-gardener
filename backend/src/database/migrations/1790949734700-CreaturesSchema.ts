import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreaturesSchema1790949734700 implements MigrationInterface {
  name = 'CreaturesSchema1790949734700';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "creatures" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "planet_id" uuid NOT NULL, "species" character varying(16) NOT NULL, "name" character varying(40) NOT NULL, "identity" jsonb NOT NULL, "identity_source" character varying(8) NOT NULL, "mood" character varying(12) NOT NULL DEFAULT 'content', "mood_since" TIMESTAMP WITH TIME ZONE NOT NULL, "wistful" boolean NOT NULL DEFAULT false, "lat" double precision NOT NULL, "lon" double precision NOT NULL, "arrived_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_8cb042c5f12e3a089b0aad287f9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_40c57b0024f0398c4e590c21df" ON "creatures"  ("planet_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "creatures" ADD CONSTRAINT "FK_40c57b0024f0398c4e590c21df6" FOREIGN KEY ("planet_id") REFERENCES "planets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "creatures" DROP CONSTRAINT "FK_40c57b0024f0398c4e590c21df6"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_40c57b0024f0398c4e590c21df"`,
    );
    await queryRunner.query(`DROP TABLE "creatures"`);
  }
}
