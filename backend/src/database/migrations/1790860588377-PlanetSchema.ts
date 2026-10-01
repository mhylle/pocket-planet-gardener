import { MigrationInterface, QueryRunner } from 'typeorm';

export class PlanetSchema1790860588377 implements MigrationInterface {
  name = 'PlanetSchema1790860588377';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "planets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "code" character(8) NOT NULL, "name" character varying(64) NOT NULL, "radius_level" integer NOT NULL DEFAULT '1', "max_plants" integer NOT NULL DEFAULT '60', "version" integer NOT NULL DEFAULT '1', "last_simulated_at" TIMESTAMP WITH TIME ZONE NOT NULL, "last_seen_at" TIMESTAMP WITH TIME ZONE NOT NULL, "sun_override_angle" double precision, "sun_override_at" TIMESTAMP WITH TIME ZONE, "tutorial_step" integer NOT NULL DEFAULT '0', "clouds" jsonb NOT NULL DEFAULT '[]', "arrival_tracking" jsonb NOT NULL DEFAULT '{}', "reward_counter" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_dfb8819655f9f5da8c073aca9cd" UNIQUE ("code"), CONSTRAINT "PK_d5fbc2513a6d4909fe31938b0fd" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "planets"`);
  }
}
