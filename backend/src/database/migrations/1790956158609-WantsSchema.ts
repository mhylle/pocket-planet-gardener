import { MigrationInterface, QueryRunner } from 'typeorm';

export class WantsSchema1790956158609 implements MigrationInterface {
  name = 'WantsSchema1790956158609';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "creature_memories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "creature_id" uuid NOT NULL, "kind" character varying(8) NOT NULL, "text" character varying(400) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_02169ea04ad0942b25e2c31dd30" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6cfe75b817033726084953e36a" ON "creature_memories"  ("creature_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "wants" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "creature_id" uuid NOT NULL, "planet_id" uuid NOT NULL, "spec" jsonb NOT NULL, "text" character varying(400) NOT NULL, "plain_description" character varying(200) NOT NULL, "status" character varying(12) NOT NULL DEFAULT 'active', "source" character varying(8) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, "resolved_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_17fded671bf39ecef45a3f0aa38" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_dd0c5636fe6a0dd48aaed2a668" ON "wants"  ("creature_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_31a3d9278e19f0bd1a5f20c6e8" ON "wants"  ("planet_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_dc3d4908111ad5b5fb4c94e1d5" ON "wants"  ("creature_id") WHERE "status" = 'active'`,
    );
    await queryRunner.query(
      `ALTER TABLE "creature_memories" ADD CONSTRAINT "FK_6cfe75b817033726084953e36a8" FOREIGN KEY ("creature_id") REFERENCES "creatures"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "wants" ADD CONSTRAINT "FK_dd0c5636fe6a0dd48aaed2a6688" FOREIGN KEY ("creature_id") REFERENCES "creatures"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "wants" ADD CONSTRAINT "FK_31a3d9278e19f0bd1a5f20c6e81" FOREIGN KEY ("planet_id") REFERENCES "planets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "wants" DROP CONSTRAINT "FK_31a3d9278e19f0bd1a5f20c6e81"`,
    );
    await queryRunner.query(
      `ALTER TABLE "wants" DROP CONSTRAINT "FK_dd0c5636fe6a0dd48aaed2a6688"`,
    );
    await queryRunner.query(
      `ALTER TABLE "creature_memories" DROP CONSTRAINT "FK_6cfe75b817033726084953e36a8"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_dc3d4908111ad5b5fb4c94e1d5"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_31a3d9278e19f0bd1a5f20c6e8"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_dd0c5636fe6a0dd48aaed2a668"`,
    );
    await queryRunner.query(`DROP TABLE "wants"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6cfe75b817033726084953e36a"`,
    );
    await queryRunner.query(`DROP TABLE "creature_memories"`);
  }
}
