# Pocket Planet Gardener

A proof of concept of Pocket Planet Gardener: a small 3D planet the player
tends in the browser, with an Angular frontend, a NestJS backend and a
PostgreSQL database. It is being built task by task from the implementation
plan in `docs/plans/2026-10-01-pocket-planet-gardener-poc.md`. The functional
solution description is in `docs/pocket-planet-gardener-SD.md`.

```
backend/    NestJS 11 + TypeORM + PostgreSQL
frontend/   Angular 21 (standalone, zoneless, single page)
```

## Prerequisites

- Node.js 20+
- A running PostgreSQL instance
- An OpenAI-compatible AI endpoint (LiteLLM, Azure OpenAI, Scaleway, Ollama...)

## 1. Database

If you use the bundled compose file (it starts its own container on host port
`5443`, so it will not collide with other PostgreSQL containers you already run):

```bash
docker compose up -d
```

Otherwise point the backend at your own instance by editing `backend/.env`
(copy it from `backend/.env.example` if it is missing):

| Variable         | Default       | Purpose                                       |
| ---------------- | ------------- | --------------------------------------------- |
| `DB_HOST`        | `localhost`   | PostgreSQL host                               |
| `DB_PORT`        | `5443`        | PostgreSQL port                               |
| `DB_USERNAME`    | `postgres`    | User                                          |
| `DB_PASSWORD`    | `postgres`    | Password                                      |
| `DB_NAME`        | `app`         | Database (must exist)                         |
| `DB_SYNCHRONIZE` | `false`       | Must stay false: migrations own the schema    |
| `PORT`           | `3101`        | Backend HTTP port                             |
| `CORS_ORIGIN`    | `http://localhost:4301` | Allowed browser origin              |
| `AI_BASE_URL`    | —             | OpenAI-compatible base URL (e.g. LiteLLM)     |
| `AI_API_KEY`     | —             | Provider key. Empty disables the AI; the app still boots |
| `AI_MODEL`       | —             | Model id                                      |
| `AI_TIMEOUT_MS`  | `60000`       | Per-request ceiling                           |

The game's tunable parameters are `GAME_*` variables, all listed in
`backend/.env.example` (for example `GAME_MAX_PLANTS`). Leave one unset or
empty to use its default from section 11 of the SD.

The schema is created by TypeORM migrations, never by `synchronize`. Run them
before starting the backend:

```bash
cd backend
npm run migration:run                                   # apply pending migrations
npm run migration:generate -- src/database/migrations/<Name>   # after an entity change
npm run migration:revert                                # undo the last one
```

A generated migration must also be added to `MIGRATIONS` in
`src/database/data-source.ts`.

## 2. Backend

```bash
cd backend
npm install
npm run start:dev        # http://localhost:3101
```

All routes live under `/api`. The "Planet" column marks the planet-scoped
routes, which need an `X-Planet-Id` header with the planet's id.

| Method | Endpoint                    | Planet | Description                                                      |
| ------ | --------------------------- | ------ | ---------------------------------------------------------------- |
| GET    | `/api/config`               |        | The game tunables the client needs                               |
| GET    | `/api/catalogue`            |        | Plants, decorations and species in public shape                  |
| POST   | `/api/planet`               |        | Create a planet from `{ name }`; 201 with the planet             |
| GET    | `/api/planet`               | yes    | The planet: `{ id, code, name, version, createdAt }`             |
| PATCH  | `/api/planet/name`          | yes    | Rename it from `{ name }`; 200 with the planet                   |
| GET    | `/api/planet/by-code/:code` |        | `{ id }` of the planet with that code (any case); 404 if none    |
| DELETE | `/api/planet`               | yes    | Delete it and all its data; needs `{ confirm: "DELETE" }`; 204   |

On a planet-scoped route a missing or malformed `X-Planet-Id` is a 400 and an
unknown one is a 404 `This planet has drifted away`. The PoC has no accounts
and no authentication (decision D-0 in the plan): anyone who has a planet's
id or code can open, change or delete that planet.

A planet name must be 2 to 24 characters (`GAME_PLANET_NAME_MIN` and
`GAME_PLANET_NAME_MAX`) and pass a small offensive-word filter. A refused
name is a 400 whose `message` is a friendly sentence to show the player.

Services read the time from `ClockService`, never from `new Date()`. An e2e
test can run a request at a fixed instant by sending an `X-Test-Now` header
with an ISO timestamp, e.g. `X-Test-Now: 2030-01-01T00:00:00.000Z`. The
header is honoured only when `NODE_ENV=test` (Jest sets it) and ignored
everywhere else.

```bash
cd backend
npm test                 # unit specs
npm run test:e2e         # e2e specs, against the dev database
```

`npm run test:e2e` uses the database in `backend/.env` and empties its
`planets` table, and with it every table that cascades from it. Planets you
created while playing are gone afterwards.

## 3. Frontend

```bash
cd frontend
npm install
npm start                # http://localhost:4301
```

`proxy.conf.json` forwards `/api` to `http://localhost:3101`, so the frontend
never hardcodes the backend host.

## Layout

```
backend/src
├── app.module.ts            root module: config, TypeORM, feature modules
├── app.setup.ts             global /api prefix, validation pipe
├── main.ts                  bootstrap, CORS
├── common/                  ClockService, RandomService, X-Test-Now middleware (global)
├── game-config/             GameConfigService (GAME_* tunables), GET /api/config
├── content/                 game data as code: plants, decorations, species,
│                            starter seeds, blocked words and names
├── catalogue/               GET /api/catalogue, the public view of content/
├── planets/
│   ├── planet.entity.ts     the planets table; a planet is also the player (D-0)
│   ├── planets.controller.ts  the /api/planet routes
│   ├── planets.service.ts   create, get, rename, open by code, delete
│   ├── planet-code.ts       8-character planet codes (pure helper)
│   ├── name-rules.ts        length and offensive-word checks for names (pure helper)
│   ├── dto/
│   └── planet-context/      PlanetGuard (X-Planet-Id), @CurrentPlanet(), @NoPlanet()
├── database/
│   ├── data-source.ts       DataSource for the TypeORM CLI, MIGRATIONS list
│   └── migrations/
└── ai/
    ├── ai.module.ts         not imported by AppModule yet
    ├── ai.service.ts        OpenAI-compatible adapter (no routes)
    └── ai.types.ts

frontend/src/app
├── app.ts / app.html        root App: shows one view at a time (no router)
├── app.config.ts            HttpClient, loads the game config at startup
├── core/
│   ├── models/              game-config, planet: mirrors of the backend DTOs
│   ├── services/
│   │   ├── api.service.ts               /api prefix, adds X-Planet-Id
│   │   ├── planet-identity.service.ts   the planet id in localStorage
│   │   ├── view-state.service.ts        current view, ?admin=1
│   │   ├── game-config.service.ts       the tunables from /api/config
│   │   └── planet.service.ts            create, open, rename, leave, delete
│   └── helpers/
│       └── error-message.ts friendly text for a failed request
├── scene/                   SCENE_RENDERER token, NullSceneRenderer for specs
└── ui/
    ├── create-planet/       name a new planet or open one by its code
    ├── planet-page/         the planet screen (the 3D view comes later)
    ├── settings-panel/      planet code, rename, leave, delete
    └── planet-name-form/    name field with a length counter, for create and rename
```
