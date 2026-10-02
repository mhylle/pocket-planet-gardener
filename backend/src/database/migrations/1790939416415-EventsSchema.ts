import { MigrationInterface, QueryRunner } from 'typeorm';

export class EventsSchema1790939416415 implements MigrationInterface {
  name = 'EventsSchema1790939416415';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "planet_id" uuid NOT NULL, "type" character varying(48) NOT NULL, "payload" jsonb NOT NULL, "occurred_at" TIMESTAMP WITH TIME ZONE NOT NULL, "is_milestone" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_40731c7151fe4be3116e45ddf73" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2dc2f7e30deae697809f7e99b1" ON "events"  ("planet_id", "occurred_at") `,
    );
    await queryRunner.query(
      `ALTER TABLE "events" ADD CONSTRAINT "FK_ac3df5dc9024e651b4f5ed0f521" FOREIGN KEY ("planet_id") REFERENCES "planets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "events" DROP CONSTRAINT "FK_ac3df5dc9024e651b4f5ed0f521"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2dc2f7e30deae697809f7e99b1"`,
    );
    await queryRunner.query(`DROP TABLE "events"`);
  }
}
