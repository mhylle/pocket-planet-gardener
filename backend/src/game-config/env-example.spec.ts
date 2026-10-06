import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseEnv } from 'node:util';

// backend/.env.example lists exactly the variables the code reads (Task 17.6),
// so a new setting cannot go undocumented and a dropped one cannot linger.
// Only .env.example is read here, never .env.

// Jest runs from backend/, so the paths start there.
const SRC_DIR = 'src';
const ENV_EXAMPLE = '.env.example';

/** Variables the code reads that .env.example leaves out on purpose, each with the reason. */
const NOT_IN_ENV_EXAMPLE: Record<string, string> = {
  // Jest sets it to test, which turns on the X-Test-Now header; in .env it
  // would turn the test clock on for the running server.
  NODE_ENV: 'set by the runtime, never in .env',
};

/**
 * A variable read through ConfigService (get, getOrThrow), GameConfigService's
 * read(), data-source.ts's env(), or straight from process.env (main.ts).
 */
const READS = [
  /\b(?:get|getOrThrow|read|env)(?:<[^>]*>)?\(\s*['"]([A-Z][A-Z0-9_]*)['"]/g,
  /\bprocess\.env\.([A-Z][A-Z0-9_]*)/g,
  /\bprocess\.env\[\s*['"]([A-Z][A-Z0-9_]*)['"]\s*\]/g,
];

/** Every variable a non-spec source file under src/ reads, sorted, each once. */
function variablesRead(): string[] {
  const files = readdirSync(SRC_DIR, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'))
    .map((file) => readFileSync(join(SRC_DIR, file), 'utf8'));
  const keys = files.flatMap((source) =>
    READS.flatMap((pattern) =>
      [...source.matchAll(pattern)].map(([, key]) => key),
    ),
  );
  return [...new Set(keys)].sort();
}

/** The variables .env.example names, sorted. */
function variablesListed(): string[] {
  return Object.keys(parseEnv(readFileSync(ENV_EXAMPLE, 'utf8'))).sort();
}

describe('.env.example', () => {
  it('finds the reads of every kind', () => {
    expect(variablesRead()).toEqual(
      expect.arrayContaining([
        'DB_HOST', // config.get in app.module.ts, env() in data-source.ts
        'AI_API_KEY', // config.get in ai.service.ts
        'GAME_CLOUD_DRIFT_DEGREES_PER_MINUTE', // read() over two lines
        'SUPPORT_URL', // config.get in GameConfigService
        'PORT', // process.env in main.ts
        'NODE_ENV', // config.get in the test-clock middleware
      ]),
    );
  });

  it('lists every variable the code reads, and nothing else', () => {
    const expected = variablesRead().filter(
      (key) => !(key in NOT_IN_ENV_EXAMPLE),
    );
    expect(variablesListed()).toEqual(expected);
  });
});
