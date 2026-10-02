import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { CreatureMemory } from '../src/creatures/creature-memory.entity';
import { Creature } from '../src/creatures/creature.entity';
import { Planet } from '../src/planets/planet.entity';
import type { WantSpec } from '../src/wants/want-evaluator';
import { Want, type WantStatus } from '../src/wants/want.entity';
import { bootWithFakeAi } from './support/app';
import { FakeAiService } from './support/fake-ai';

const NOW = new Date('2030-01-01T00:00:00.000Z');
const UNIQUE_VIOLATION = '23505';

const SPEC: WantSpec = {
  type: 'plant-near',
  plant: 'moonflower',
  count: 2,
  near: { kind: 'decoration', decoration: 'lamp-post' },
  withinSteps: 3,
};

// Uses the dev database and empties the planets table and its children.
describe('Wants schema (e2e)', () => {
  let app: INestApplication<App>;
  let db: DataSource;

  beforeAll(async () => {
    app = await bootWithFakeAi(new FakeAiService());
    db = app.get(DataSource);
  });

  beforeEach(async () => {
    await db.query('TRUNCATE "planets" CASCADE');
  });

  afterAll(async () => {
    await db.query('TRUNCATE "planets" CASCADE');
    await app.close();
  });

  function insertPlanet(): Promise<Planet> {
    return db.getRepository(Planet).save({
      code: 'WANTS001',
      name: 'Moonbeam',
      lastSimulatedAt: NOW,
      lastSeenAt: NOW,
    });
  }

  function insertCreature(planetId: string, name: string): Promise<Creature> {
    return db.getRepository(Creature).save({
      planetId,
      species: 'snail',
      name,
      identity: {
        traits: ['patient', 'proud'],
        quirk: 'Counts its own steps.',
        speakingStyle: 'Grand and slow.',
        backstory: 'It came for the pond.',
        summary: 'A proud snail.',
      },
      identitySource: 'fallback',
      moodSince: NOW,
      lat: 0,
      lon: 0,
      arrivedAt: NOW,
    });
  }

  function insertWant(
    creature: Creature,
    status: WantStatus = 'active',
  ): Promise<Want> {
    return db.getRepository(Want).save({
      creatureId: creature.id,
      planetId: creature.planetId,
      spec: SPEC,
      text: 'One requires moonflowers. Near the lamp-post, obviously.',
      plainDescription: '2 moonflowers within 3 steps of the lamp-post',
      status,
      source: 'ai',
      createdAt: NOW,
      resolvedAt: status === 'active' ? null : NOW,
    });
  }

  function insertMemory(creature: Creature): Promise<CreatureMemory> {
    return db.getRepository(CreatureMemory).save({
      creatureId: creature.id,
      kind: 'want',
      text: 'Was given moonflowers by the lamp-post.',
      createdAt: NOW,
    });
  }

  function countChildren(creatureId: string): Promise<number[]> {
    return Promise.all([
      db.getRepository(Want).countBy({ creatureId }),
      db.getRepository(CreatureMemory).countBy({ creatureId }),
    ]);
  }

  it('reads a want and a memory back, with the spec as JSON', async () => {
    const planet = await insertPlanet();
    const creature = await insertCreature(planet.id, 'Mira');
    const { id } = await insertWant(creature);
    await insertMemory(creature);

    const want = await db.getRepository(Want).findOneByOrFail({ id });
    const [memory] = await db
      .getRepository(CreatureMemory)
      .findBy({ creatureId: creature.id });

    expect(want).toMatchObject({
      creatureId: creature.id,
      planetId: planet.id,
      spec: SPEC,
      status: 'active',
      source: 'ai',
      resolvedAt: null,
    });
    expect(want.createdAt.toISOString()).toBe(NOW.toISOString());
    expect(memory).toMatchObject({ kind: 'want', creatureId: creature.id });
  });

  it('defaults a new want to active', async () => {
    const planet = await insertPlanet();
    const creature = await insertCreature(planet.id, 'Mira');

    const { id } = await db.getRepository(Want).save({
      creatureId: creature.id,
      planetId: planet.id,
      spec: SPEC,
      text: 'Moonflowers, please.',
      plainDescription: '2 moonflowers within 3 steps of the lamp-post',
      source: 'fallback',
      createdAt: NOW,
    });

    expect(await db.getRepository(Want).findOneByOrFail({ id })).toMatchObject({
      status: 'active',
    });
  });

  it('refuses a second active want for the same creature (WNT-01 AC2)', async () => {
    const planet = await insertPlanet();
    const creature = await insertCreature(planet.id, 'Mira');
    await insertWant(creature);

    await expect(insertWant(creature)).rejects.toMatchObject({
      driverError: { code: UNIQUE_VIOLATION },
    });
  });

  it('keeps fulfilled and dismissed wants beside the active one', async () => {
    const planet = await insertPlanet();
    const creature = await insertCreature(planet.id, 'Mira');
    await insertWant(creature, 'fulfilled');
    await insertWant(creature, 'fulfilled');
    await insertWant(creature, 'dismissed');
    await insertWant(creature);

    expect(await countChildren(creature.id)).toEqual([4, 0]);
  });

  it('takes a new active want once the old one is resolved', async () => {
    const planet = await insertPlanet();
    const creature = await insertCreature(planet.id, 'Mira');
    const old = await insertWant(creature);

    await db
      .getRepository(Want)
      .update({ id: old.id }, { status: 'dismissed', resolvedAt: NOW });
    await insertWant(creature);

    const active = await db
      .getRepository(Want)
      .countBy({ creatureId: creature.id, status: 'active' });
    expect(active).toBe(1);
  });

  it('lets every creature have its own active want', async () => {
    const planet = await insertPlanet();
    const mira = await insertCreature(planet.id, 'Mira');
    const otto = await insertCreature(planet.id, 'Otto');

    await insertWant(mira);
    await insertWant(otto);

    expect(await db.getRepository(Want).countBy({ status: 'active' })).toBe(2);
  });

  it('deletes wants and memories with their creature', async () => {
    const planet = await insertPlanet();
    const mira = await insertCreature(planet.id, 'Mira');
    const otto = await insertCreature(planet.id, 'Otto');
    for (const creature of [mira, otto]) {
      await insertWant(creature);
      await insertMemory(creature);
    }

    await db.getRepository(Creature).delete({ id: mira.id });

    expect(await countChildren(mira.id)).toEqual([0, 0]);
    expect(await countChildren(otto.id)).toEqual([1, 1]);
  });

  it('deletes wants and memories with their planet (ACC-05)', async () => {
    const planet = await insertPlanet();
    const creature = await insertCreature(planet.id, 'Mira');
    await insertWant(creature, 'fulfilled');
    await insertWant(creature);
    await insertMemory(creature);
    expect(await countChildren(creature.id)).toEqual([2, 1]);

    await db.getRepository(Planet).delete({ id: planet.id });

    expect(await countChildren(creature.id)).toEqual([0, 0]);
    expect(await db.getRepository(Want).countBy({ planetId: planet.id })).toBe(
      0,
    );
  });
});
