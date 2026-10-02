import { readFileSync } from 'node:fs';
import { GameConfigService } from './game-config.service';

/**
 * GameConfigService only needs ConfigService#get, so it is constructed
 * directly with a stub, as in ai.service.spec.ts.
 */
function buildService(env: Record<string, string> = {}): GameConfigService {
  return new GameConfigService({ get: (key: string) => env[key] } as never);
}

/** SD section 11, written out independently of the service. */
const sdDefaults: Record<string, number> = {
  maxPlants: 60,
  cloudRefillSeconds: 60,
  // Not in the SD table either: the clouds and their rain (Task 7.2).
  cloudCount: 3,
  cloudDriftDegreesPerMinute: 6,
  rainSeconds: 8,
  rainRadiusSteps: 2,
  rainWaterPerSecond: 0.15,
  sunOverrideMinutes: 5,
  // The one tunable the SD table lacks: the sun's drift period (Task 6.1).
  sunDayMinutes: 60,
  unmetNeedGrowthFactor: 0.5,
  seedsPerHarvestMin: 1,
  seedsPerHarvestMax: 2,
  harvestCooldownMinutes: 60,
  starterSeedTypes: 3,
  arrivalDelaySeconds: 120,
  arrivalSpacingMinutes: 30,
  maxCreatures: 8,
  maxPerSpecies: 2,
  overjoyedGiftHours: 24,
  wantCooldownMinutes: 60,
  unlockEveryNRewards: 3,
  chatMessageMaxChars: 200,
  chatAnswerMaxWords: 60,
  aiTimeoutMs: 15000,
  chatDailyLimit: 30,
  maxAwayDays: 7,
  summaryAfterMinutes: 60,
  journalAfterHours: 4,
  journalMaxWords: 150,
  syncIntervalSeconds: 10,
  planetNameMin: 2,
  planetNameMax: 24,
};

/** The variable a getter reads, e.g. maxPlants is GAME_MAX_PLANTS. */
function envKey(name: string): string {
  return 'GAME_' + name.replace(/[A-Z]/g, (c) => '_' + c).toUpperCase();
}

type Tunable = Exclude<keyof GameConfigService, 'publicConfig' | 'supportUrl'>;

function valueOf(service: GameConfigService, name: string): number {
  return service[name as Tunable];
}

describe('GameConfigService', () => {
  it('has exactly the tunables of the SD table, beside the support link', () => {
    expect(Object.keys(buildService()).sort()).toEqual(
      [...Object.keys(sdDefaults), 'supportUrl'].sort(),
    );
  });

  it('reads the support link from SUPPORT_URL, defaulting to findahelpline.com', () => {
    expect(buildService().supportUrl).toBe('https://findahelpline.com');
    expect(buildService({ SUPPORT_URL: '  ' }).supportUrl).toBe(
      'https://findahelpline.com',
    );
    expect(
      buildService({ SUPPORT_URL: 'https://example.org/help' }).supportUrl,
    ).toBe('https://example.org/help');
  });

  it.each(Object.entries(sdDefaults))('defaults %s to %p', (name, value) => {
    expect(valueOf(buildService(), name)).toBe(value);
  });

  it.each(Object.keys(sdDefaults))(
    'reads %s from its GAME_ variable',
    (name) => {
      const override = sdDefaults[name] + 1;
      const service = buildService({ [envKey(name)]: String(override) });

      expect(valueOf(service, name)).toBe(override);
    },
  );

  it('honours integer and fractional overrides', () => {
    const service = buildService({
      GAME_MAX_PLANTS: '80',
      GAME_UNMET_NEED_GROWTH_FACTOR: '0.25',
    });

    expect(service.maxPlants).toBe(80);
    expect(service.unmetNeedGrowthFactor).toBe(0.25);
  });

  it.each(['', '   ', 'lots', 'NaN', 'Infinity'])(
    'falls back to the default for %p',
    (raw) => {
      expect(buildService({ GAME_MAX_PLANTS: raw }).maxPlants).toBe(60);
    },
  );

  it('serves only the client-relevant subset', () => {
    const config = buildService().publicConfig();

    expect(Object.keys(config)).toEqual([
      'planetNameMin',
      'planetNameMax',
      'maxPlants',
      'maxCreatures',
      'chatMessageMaxChars',
      'chatDailyLimit',
      'syncIntervalSeconds',
      'cloudRefillSeconds',
      'cloudDriftDegreesPerMinute',
      'rainSeconds',
      'rainRadiusSteps',
      'sunOverrideMinutes',
      'sunDayMinutes',
      'summaryAfterMinutes',
      'journalAfterHours',
    ]);
    expect(config).not.toHaveProperty('aiTimeoutMs');
    expect(config).not.toHaveProperty('supportUrl');
    for (const [name, value] of Object.entries(config)) {
      expect(value).toBe(sdDefaults[name]);
    }
  });

  it('lists every GAME_ variable in .env.example with an empty value', () => {
    // npm test runs from backend/, where .env.example lives.
    const example = readFileSync('.env.example', 'utf8');

    expect(example.match(/^GAME_.*$/gm)?.sort()).toEqual(
      Object.keys(sdDefaults)
        .map((name) => envKey(name) + '=')
        .sort(),
    );
  });
});
