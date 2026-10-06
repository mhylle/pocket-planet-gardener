import { INestApplication } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { App } from 'supertest/types';
import { bootWithFakeAi } from './support/app';
import { FakeAiService } from './support/fake-ai';

// The README's endpoint table must list exactly the routes the app
// registers (Task 17.6), so a new, renamed or removed route fails here
// until the table says so too.

// Jest runs from backend/, so the path starts there.
const README = join('..', 'README.md');

/** A table row such as "| GET | /api/config | | ... |", with the path in backticks. */
const ENDPOINT_ROW =
  /^\|\s*(GET|POST|PUT|PATCH|DELETE)\s*\|\s*`(\/api\/[^`]*)`/gm;

/** The part of Express 5's router this spec reads. */
interface ExpressApp {
  router: {
    stack: { route?: { path: string; methods: Record<string, boolean> } }[];
  };
}

/** "METHOD /path" for every endpoint row in the README, sorted. */
function documentedRoutes(): string[] {
  const readme = readFileSync(README, 'utf8');
  return [...readme.matchAll(ENDPOINT_ROW)]
    .map(([, method, path]) => `${method} ${path}`)
    .sort();
}

/** "METHOD /path" for every route the app serves, with the /api prefix, sorted. */
function registeredRoutes(app: INestApplication): string[] {
  const { router } = app.getHttpAdapter().getInstance() as ExpressApp;
  return router.stack
    .flatMap(({ route }) =>
      route
        ? Object.keys(route.methods)
            // The test-clock middleware is mounted for every method ("_all"); it is no endpoint.
            .filter((method) => method !== '_all')
            .map((method) => `${method.toUpperCase()} ${route.path}`)
        : [],
    )
    .sort();
}

describe('README endpoint table (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await bootWithFakeAi(new FakeAiService());
  });

  afterAll(async () => {
    await app.close();
  });

  it('finds the routes and the table rows', () => {
    expect(registeredRoutes(app)).toContain('GET /api/config');
    expect(documentedRoutes()).toContain('GET /api/config');
  });

  it('lists every registered route once, and nothing else', () => {
    expect(documentedRoutes()).toEqual(registeredRoutes(app));
  });
});
