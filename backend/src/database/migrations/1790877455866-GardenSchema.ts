import { MigrationInterface, QueryRunner } from 'typeorm';

export class GardenSchema1790877455866 implements MigrationInterface {
  name = 'GardenSchema1790877455866';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "decorations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "planet_id" uuid NOT NULL, "type" character varying(32) NOT NULL, "lat" double precision NOT NULL, "lon" double precision NOT NULL, "placed_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_fa3e1e1d855c4e885ec9d907ff5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_996b109f14c45610a701878205" ON "decorations"  ("planet_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "plants" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "planet_id" uuid NOT NULL, "type" character varying(32) NOT NULL, "lat" double precision NOT NULL, "lon" double precision NOT NULL, "stage" character varying(16) NOT NULL DEFAULT 'seed', "growth" double precision NOT NULL DEFAULT '0', "water" double precision NOT NULL DEFAULT '0.5', "planted_at" TIMESTAMP WITH TIME ZONE NOT NULL, "last_harvested_at" TIMESTAMP WITH TIME ZONE, "harvest_ready" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_7056d6b283b48ee2bb0e53bee60" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_60ab57777ef157ba5bb1d21f43" ON "plants"  ("planet_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "inventory_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "planet_id" uuid NOT NULL, "item_type" character varying(32) NOT NULL, "kind" character varying(16) NOT NULL, "count" integer NOT NULL DEFAULT '0', CONSTRAINT "UQ_589ee43af574e143c124f580480" UNIQUE ("planet_id", "item_type"), CONSTRAINT "PK_cf2f451407242e132547ac19169" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "unlocks" ("planet_id" uuid NOT NULL, "item_type" character varying(32) NOT NULL, "unlocked_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_c58f1b45eb55470cd03e6c95b6f" PRIMARY KEY ("planet_id", "item_type"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "decorations" ADD CONSTRAINT "FK_996b109f14c45610a7018782054" FOREIGN KEY ("planet_id") REFERENCES "planets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "plants" ADD CONSTRAINT "FK_60ab57777ef157ba5bb1d21f433" FOREIGN KEY ("planet_id") REFERENCES "planets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_items" ADD CONSTRAINT "FK_b1aad560e50382468c36fb03afa" FOREIGN KEY ("planet_id") REFERENCES "planets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "unlocks" ADD CONSTRAINT "FK_67ad8ed5bdc1cd895222194a0f7" FOREIGN KEY ("planet_id") REFERENCES "planets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "unlocks" DROP CONSTRAINT "FK_67ad8ed5bdc1cd895222194a0f7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_items" DROP CONSTRAINT "FK_b1aad560e50382468c36fb03afa"`,
    );
    await queryRunner.query(
      `ALTER TABLE "plants" DROP CONSTRAINT "FK_60ab57777ef157ba5bb1d21f433"`,
    );
    await queryRunner.query(
      `ALTER TABLE "decorations" DROP CONSTRAINT "FK_996b109f14c45610a7018782054"`,
    );
    await queryRunner.query(`DROP TABLE "unlocks"`);
    await queryRunner.query(`DROP TABLE "inventory_items"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_60ab57777ef157ba5bb1d21f43"`,
    );
    await queryRunner.query(`DROP TABLE "plants"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_996b109f14c45610a701878205"`,
    );
    await queryRunner.query(`DROP TABLE "decorations"`);
  }
}
