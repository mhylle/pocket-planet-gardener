import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatureChatSchema1790964578421 implements MigrationInterface {
  name = 'CreatureChatSchema1790964578421';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "chat_messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "creature_id" uuid NOT NULL, "planet_id" uuid NOT NULL, "role" character varying(8) NOT NULL, "text" character varying(1200) NOT NULL, "source" character varying(10), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_40c55ee0e571e268b0d3cd37d10" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_19613ac639374cc38db55139bd" ON "chat_messages"  ("planet_id", "role", "created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_18022e4e9cd4a995fb8221255c" ON "chat_messages"  ("creature_id", "created_at") `,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_messages" ADD CONSTRAINT "FK_bc2507f2cfd3a9402f136880070" FOREIGN KEY ("creature_id") REFERENCES "creatures"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_messages" ADD CONSTRAINT "FK_e05569af0e86ba915f13d9d96a6" FOREIGN KEY ("planet_id") REFERENCES "planets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chat_messages" DROP CONSTRAINT "FK_e05569af0e86ba915f13d9d96a6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_messages" DROP CONSTRAINT "FK_bc2507f2cfd3a9402f136880070"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_18022e4e9cd4a995fb8221255c"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_19613ac639374cc38db55139bd"`,
    );
    await queryRunner.query(`DROP TABLE "chat_messages"`);
  }
}
