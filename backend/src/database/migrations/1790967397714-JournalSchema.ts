import { MigrationInterface, QueryRunner } from 'typeorm';

export class JournalSchema1790967397714 implements MigrationInterface {
  name = 'JournalSchema1790967397714';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "journal_entries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "planet_id" uuid NOT NULL, "text" character varying(2000) NOT NULL, "source" character varying(10) NOT NULL, "covers_from" TIMESTAMP WITH TIME ZONE NOT NULL, "covers_to" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_a70368e64230434457c8d007ab3" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7b144d76f7dcb49204bf5d2dc3" ON "journal_entries"  ("planet_id", "created_at" DESC) `,
    );
    await queryRunner.query(
      `ALTER TABLE "journal_entries" ADD CONSTRAINT "FK_30d96f0835e1c9f2de23b02f0a1" FOREIGN KEY ("planet_id") REFERENCES "planets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "journal_entries" DROP CONSTRAINT "FK_30d96f0835e1c9f2de23b02f0a1"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_7b144d76f7dcb49204bf5d2dc3"`,
    );
    await queryRunner.query(`DROP TABLE "journal_entries"`);
  }
}
