/**
 * Dev-only seed for the performance run (NFR-02, Task 17.1): one new planet
 * filled to the limits of GameConfigService, with maxPlants plants in mixed
 * stages spread over free spots by the placement rules, one of each
 * decoration, maxCreatures creatures with pre-written identities and the
 * game's clouds. Writes through PlanetsService and the entities; never asks
 * the model. Refuses to run with NODE_ENV=production.
 *
 *   npm run seed:full-planet
 *
 * Then open the planet in the browser with
 * localStorage.setItem('ppg.planetId', '<id>') and a reload.
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { ClockService } from '../src/common/clock.service';
import type { SpeciesId } from '../src/content/content.types';
import { DECORATIONS } from '../src/content/decorations';
import { FALLBACK_IDENTITIES } from '../src/content/fallback-identities';
import { PLANTS } from '../src/content/plants';
import { SPECIES } from '../src/content/species';
import type { CreatureMood } from '../src/creatures/creature.entity';
import { Creature } from '../src/creatures/creature.entity';
import { chooseHomeSpot } from '../src/creatures/home-spot';
import { GameConfigService } from '../src/game-config/game-config.service';
import { Decoration } from '../src/garden/decoration.entity';
import { Plant } from '../src/garden/plant.entity';
import { Unlock } from '../src/inventory/unlock.entity';
import { Planet } from '../src/planets/planet.entity';
import { PlanetsService } from '../src/planets/planets.service';
import { initialClouds } from '../src/simulation/cloud-rules';
import { stageFor } from '../src/simulation/growth-rules';
import {
  canPlaceAt,
  PLANT_FOOTPRINT_STEPS,
  type PlacementState,
} from '../src/simulation/placement-rules';
import type { SurfacePoint } from '../src/simulation/surface-coords';

const PLANET_NAME = 'Full Bloom';
const HOUR_MS = 3_600_000;
// Seed, sprout, young and bloom, with more blooms than the rest.
const GROWTH = [0.1, 0.35, 0.7, 1, 1];
const MOODS: CreatureMood[] = ['content', 'cheerful', 'overjoyed'];
// The worm comes with the first bloom and only once per planet.
const ONE_PER_PLANET: SpeciesId[] = ['worm'];

/** Points spread evenly over the sphere (a Fibonacci lattice), poles left out. */
function lattice(count: number): SurfacePoint[] {
  const golden = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: count }, (_, i) => {
    const y = 0.95 - (1.9 * (i + 0.5)) / count;
    const lon = ((((i * golden * 180) / Math.PI + 180) % 360) + 360) % 360;
    return { lat: (Math.asin(y) * 180) / Math.PI, lon: lon - 180 };
  });
}

/** The species to seed: each once, then again up to maxPerSpecies, until maxCreatures. */
function speciesToSeed(config: GameConfigService): SpeciesId[] {
  const chosen: SpeciesId[] = [];
  for (let round = 0; round < config.maxPerSpecies; round++) {
    for (const { id } of SPECIES) {
      const allowed = ONE_PER_PLANET.includes(id) ? 1 : config.maxPerSpecies;
      const held = chosen.filter((each) => each === id).length;
      if (
        chosen.length < config.maxCreatures &&
        held < allowed &&
        held === round
      ) {
        chosen.push(id);
      }
    }
  }
  return chosen;
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to seed: NODE_ENV is production.');
    process.exit(1);
  }
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  // ConfigModule has read .env by now, which may set NODE_ENV too.
  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to seed: NODE_ENV is production.');
    await app.close();
    process.exit(1);
  }
  const config = app.get(GameConfigService);
  const now = app.get(ClockService).now();
  const created = await app
    .get(PlanetsService, { strict: false })
    .create(PLANET_NAME);

  await app.get(DataSource).transaction(async (em) => {
    const planetId = created.id;
    const state: PlacementState = {
      plants: [],
      decorations: [],
      maxPlants: config.maxPlants,
    };
    const spots = lattice(config.maxPlants + DECORATIONS.length + 40);
    // A stride coprime with the lattice size visits it in a scattered order.
    const order = spots.map((_, i) => spots[(i * 37) % spots.length]);
    let next = 0;
    const freeSpot = (kind: 'plant' | 'decoration', footprintSteps: number) => {
      while (next < order.length) {
        const point = order[next++];
        if (canPlaceAt(state, { kind, point, footprintSteps }) === 'ok') {
          return point;
        }
      }
      throw new Error(`No free spot left for a ${kind}.`);
    };

    for (const decoration of DECORATIONS) {
      const point = freeSpot('decoration', decoration.footprintSteps);
      const saved = await em.save(Decoration, {
        planetId,
        type: decoration.id,
        ...point,
        placedAt: now,
      });
      state.decorations.push({
        id: saved.id,
        ...point,
        footprintSteps: decoration.footprintSteps,
        isWater: decoration.isWater,
      });
    }

    for (let i = 0; i < config.maxPlants; i++) {
      const point = freeSpot('plant', PLANT_FOOTPRINT_STEPS);
      const growth = GROWTH[i % GROWTH.length];
      const stage = stageFor(growth);
      const bloom = stage === 'bloom';
      const saved = await em.save(Plant, {
        planetId,
        type: PLANTS[i % PLANTS.length].id,
        ...point,
        stage,
        growth,
        water: 0.6,
        plantedAt: new Date(now.getTime() - 3 * HOUR_MS),
        // Every other bloom has its seeds ready (sparkles); the rest were
        // picked half an hour ago.
        harvestReady: bloom && i % 2 === 0,
        lastHarvestedAt:
          bloom && i % 2 === 1 ? new Date(now.getTime() - HOUR_MS / 2) : null,
      });
      state.plants.push({ id: saved.id, ...point });
    }

    const homes: SurfacePoint[] = [];
    const species = speciesToSeed(config);
    for (const [i, kind] of species.entries()) {
      const nth = species.slice(0, i).filter((each) => each === kind).length;
      const { name, ...identity } = FALLBACK_IDENTITIES[kind][nth];
      const anchor = state.plants[(i * 5) % state.plants.length];
      const home = chooseHomeSpot(state, homes, [anchor]);
      homes.push(home);
      await em.save(Creature, {
        planetId,
        species: kind,
        name,
        identity,
        identitySource: 'fallback' as const,
        mood: MOODS[i % MOODS.length],
        moodSince: now,
        wistful: false,
        ...home,
        arrivedAt: new Date(now.getTime() - (species.length - i) * HOUR_MS),
      });
    }

    // Everything on the planet shows as unlocked in the catalogue.
    await em
      .createQueryBuilder()
      .insert()
      .into(Unlock)
      .values(
        [...PLANTS, ...DECORATIONS].map(({ id }) => ({
          planetId,
          itemType: id,
          unlockedAt: now,
        })),
      )
      .orIgnore()
      .execute();
    // The tutorial is done, so Pip leaves the view to the planet.
    await em.update(
      Planet,
      { id: planetId },
      { clouds: initialClouds(config.cloudCount, now), tutorialStep: -1 },
    );
  });

  console.log(
    `Seeded "${PLANET_NAME}": ${config.maxPlants} plants, ${DECORATIONS.length} decorations, ${speciesToSeed(config).length} creatures, ${config.cloudCount} clouds.`,
  );
  console.log(`Planet id:   ${created.id}`);
  console.log(`Planet code: ${created.code}`);
  console.log(
    `Open it with localStorage.setItem('ppg.planetId', '${created.id}') and a reload.`,
  );
  await app.close();
}

void main();
