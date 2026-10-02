import type { DecorationId } from '../content/content.types';
import type { PlanetSnapshotDto } from '../planets/dto/planet-snapshot.dto';
import {
  findPrivateData,
  toPlanetPublicState,
  toPublicEvents,
} from './prompt-context';

const planetId = '3f2b8c1e-9a4d-4e6f-8b2a-1c5d7e9f0a12';
const otherPlanetId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const plantId = '0b9e6f42-7c1d-4a8e-9f3b-2d6c8a1e5f70';
const code = 'K7MPQ2XR';
const uuidPattern =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** A snapshot that tempts a careless mapper with ids, the code and an email. */
const snapshot: Omit<PlanetSnapshotDto, 'creatures'> & {
  creatures: {
    id: string;
    planetId: string;
    name: string;
    species: string;
    summary: string;
  }[];
} = {
  id: planetId,
  code,
  name: 'Moss Moon',
  version: 7,
  createdAt: '2026-10-01T08:00:00.000Z',
  radiusLevel: 1,
  maxPlants: 12,
  tutorialStep: 3,
  serverTime: '2026-10-02T09:00:00.000Z',
  plants: [
    {
      id: plantId,
      type: 'sunflower',
      lat: 12.5,
      lon: -40,
      stage: 'bloom',
      growth: 1,
      water: 0.6,
      plantedAt: '2026-10-02T06:00:00.000Z',
      harvestReady: true,
    },
    {
      id: otherPlanetId,
      type: 'clover',
      lat: -3,
      lon: 75,
      stage: 'sprout',
      growth: 0.4,
      water: 0.2,
      plantedAt: '2026-10-02T08:00:00.000Z',
      harvestReady: false,
    },
  ],
  decorations: [
    { id: otherPlanetId, type: 'bench', lat: 1, lon: 2 },
    {
      id: plantId,
      type: 'kid@example.com' as DecorationId,
      lat: 3,
      lon: 4,
    },
  ],
  inventory: [{ itemType: 'tulip', kind: 'seed', count: 2 }],
  unlocks: ['clover', 'sunflower'],
  clouds: [],
  sun: { overrideAngle: 90, overrideAt: '2026-10-02T08:59:00.000Z' },
  creatures: [
    {
      id: plantId,
      planetId: otherPlanetId,
      name: 'Mira',
      species: 'moth',
      summary: `Loves lamps. Pen pal ${otherPlanetId} kid@example.com`,
    },
    {
      id: plantId,
      planetId,
      name: 'Sneaky',
      species: `visitor from ${otherPlanetId}`,
      summary: 'Should not appear.',
    },
  ],
};

describe('toPlanetPublicState', () => {
  it('keeps only game facts from a tempting snapshot', () => {
    expect(toPlanetPublicState(snapshot)).toEqual({
      name: 'Moss Moon',
      plants: [
        { type: 'sunflower', stage: 'bloom' },
        { type: 'clover', stage: 'sprout' },
      ],
      decorations: [{ type: 'bench' }],
      creatures: [
        { name: 'Mira', species: 'moth', summary: 'Loves lamps. Pen pal' },
      ],
    });
  });

  it('serialises without an email, a uuid, the planet code or a position', () => {
    const json = JSON.stringify(toPlanetPublicState(snapshot));
    expect(json).not.toContain('@');
    expect(json).not.toMatch(uuidPattern);
    expect(json).not.toContain(code);
    expect(json).not.toContain('lat');
    expect(findPrivateData(json, [planetId, code, otherPlanetId])).toEqual([]);
  });

  it('leaves out a plant whose type or stage is not in the catalogue', () => {
    const state = toPlanetPublicState({
      name: 'Moss Moon',
      plants: [
        { type: 'sunflower', stage: 'withered' },
        { type: otherPlanetId, stage: 'bloom' },
      ],
      decorations: [],
    });
    expect(state.plants).toEqual([]);
  });

  it('strips anything holding an @ and any uuid from the planet name', () => {
    const state = toPlanetPublicState({
      name: `kid@example.com Moss ${planetId} Moon`,
      plants: [],
      decorations: [],
    });
    expect(state.name).toBe('Moss Moon');
  });

  it('has no creatures when the source has none', () => {
    expect(
      toPlanetPublicState({ name: 'Moss Moon', plants: [], decorations: [] })
        .creatures,
    ).toEqual([]);
  });
});

describe('toPublicEvents', () => {
  const events = [
    {
      id: plantId,
      planetId,
      type: 'plant-stage',
      occurredAt: new Date('2026-10-02T07:00:00.000Z'),
      payload: { plantId, type: 'sunflower', stage: 'sprout' },
      isMilestone: false,
    },
    {
      id: otherPlanetId,
      planetId,
      type: 'plant-bloomed',
      occurredAt: new Date('2026-10-02T08:00:00.000Z'),
      payload: { plantId, type: 'sunflower', lat: 12.5, lon: -40 },
      isMilestone: true,
    },
    {
      type: 'creature-arrived',
      occurredAt: '2026-10-02T08:30:00.000Z',
      payload: {
        creatureId: plantId,
        name: 'Mira',
        species: 'moth',
        lat: 1,
        lon: 2,
        milestone: true,
      },
    },
    {
      type: 'want-fulfilled',
      occurredAt: '2026-10-02T08:40:00.000Z',
      payload: { wantId: plantId, creatureId: plantId },
    },
    {
      type: 'gift-received',
      occurredAt: '2026-10-02T08:45:00.000Z',
      payload: { from: otherPlanetId, note: 'kid@example.com' },
    },
    {
      type: 'plant-bloomed',
      occurredAt: '2026-10-02T08:50:00.000Z',
      payload: { plantId, type: 'kid@example.com' },
    },
    {
      type: 'plant-dug-up',
      occurredAt: '2026-10-02T08:55:00.000Z',
      payload: { plantId, code },
    },
  ];

  it('keeps the type, the time and a short human detail, in order', () => {
    expect(toPublicEvents(events)).toEqual([
      {
        type: 'plant-stage',
        occurredAt: '2026-10-02T07:00:00.000Z',
        detail: 'sunflower sprouted',
      },
      {
        type: 'plant-bloomed',
        occurredAt: '2026-10-02T08:00:00.000Z',
        detail: 'sunflower bloomed',
      },
      {
        type: 'creature-arrived',
        occurredAt: '2026-10-02T08:30:00.000Z',
        detail: 'Mira the moth moved in',
      },
      {
        type: 'want-fulfilled',
        occurredAt: '2026-10-02T08:40:00.000Z',
        detail: 'a wish came true',
      },
      {
        type: 'gift-received',
        occurredAt: '2026-10-02T08:45:00.000Z',
        detail: 'a gift arrived',
      },
      {
        type: 'plant-bloomed',
        occurredAt: '2026-10-02T08:50:00.000Z',
        detail: 'a plant bloomed',
      },
      {
        type: 'plant-dug-up',
        occurredAt: '2026-10-02T08:55:00.000Z',
        detail: 'plant dug up',
      },
    ]);
  });

  it('serialises without ids, positions, the code or an email', () => {
    const json = JSON.stringify(toPublicEvents(events));
    expect(json).not.toContain('lat');
    expect(findPrivateData(json, [planetId, code, otherPlanetId])).toEqual([]);
  });
});

describe('findPrivateData', () => {
  it('flags each planted secret, any other uuid and any @', () => {
    const prompt = `Planet ${planetId} (code ${code.toLowerCase()}) met ${otherPlanetId.toUpperCase()}; mail kid@example.com`;
    expect(findPrivateData(prompt, [planetId, code])).toEqual([
      planetId,
      code,
      otherPlanetId,
      '@',
    ]);
  });

  it('returns [] for a clean prompt', () => {
    const prompt = JSON.stringify(toPlanetPublicState(snapshot));
    expect(findPrivateData(prompt, [planetId, code])).toEqual([]);
    expect(findPrivateData('A sunflower bloomed.', [''])).toEqual([]);
  });
});
