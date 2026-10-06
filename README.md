# Pocket Planet Gardener

A proof of concept of Pocket Planet Gardener: a small 3D planet the player
tends in the browser, with an Angular frontend, a NestJS backend and a
PostgreSQL database. It is being built task by task from the implementation
plan in `docs/plans/2026-10-01-pocket-planet-gardener-poc.md`. The functional
solution description is in `docs/pocket-planet-gardener-SD.md`. Evidence that
takes more than a spec (manual checklists, audits, measurements, the browser
smoke list) is recorded in
`docs/plans/2026-10-01-pocket-planet-gardener-poc-verification.md`.

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
| `DB_PORT`        | `5432`        | PostgreSQL port (`.env.example` sets `5443`)  |
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
| `SUPPORT_URL`    | `https://findahelpline.com` | Where the chat's wellbeing notice links to |

The game's tunable parameters are `GAME_*` variables, all listed in
`backend/.env.example` (for example `GAME_MAX_PLANTS`). Leave one unset or
empty to use its default from section 11 of the SD. Some are not in the SD:
`GAME_SUN_DAY_MINUTES` (default 60), how long the sun takes to drift once
round the planet; `GAME_CLOUD_COUNT` (3) clouds per planet, drifting
`GAME_CLOUD_DRIFT_DEGREES_PER_MINUTE` (6) east; a full cloud holds
`GAME_RAIN_SECONDS` (8) of rain, which waters plants within
`GAME_RAIN_RADIUS_STEPS` (2, a step being 5 degrees) by
`GAME_RAIN_WATER_PER_SECOND` (0.15) for each second.

`backend/.env.example` lists exactly the variables the code reads, and
`src/game-config/env-example.spec.ts` fails when the two drift apart. The one
variable read but left out is `NODE_ENV`: Jest sets it, and it must never be
`test` in `.env`, because that turns on the test clock (below).

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
`test/readme-routes.e2e-spec.ts` checks that this table lists exactly the
routes the app registers.

| Method | Endpoint                               | Planet | Description                                                      |
| ------ | -------------------------------------- | ------ | ---------------------------------------------------------------- |
| GET    | `/api/config`                          |        | The game tunables the client needs                               |
| GET    | `/api/catalogue`                       |        | Plants, decorations and species in public shape                  |
| POST   | `/api/planet`                          |        | Create a planet from `{ name }`; 201 with its snapshot           |
| GET    | `/api/planet`                          | yes    | The planet's snapshot, see below                                 |
| PATCH  | `/api/planet/name`                     | yes    | Rename it from `{ name }`; 200 with the snapshot                 |
| POST   | `/api/planet/sync`                     | yes    | Heartbeat from `{ expectedVersion }`; 200 `{ snapshot, events, newlyUnlocked }`, on return also `welcomeBack` |
| GET    | `/api/planet/by-code/:code`            |        | `{ id }` of the planet with that code (any case); 404 if none    |
| GET    | `/api/tutorial`                        |        | Pip's steps in order, `{ steps: [{ id, text, highlight }] }`     |
| PATCH  | `/api/planet/tutorial`                 | yes    | Keep the tutorial step reached from `{ step }`; 200 `{ tutorialStep }` |
| GET    | `/api/planet/settings`                 | yes    | `{ musicVolume, musicMuted, sfxVolume, sfxMuted, reducedMotion }`, defaults 0.6, false, 0.8, false, `auto` for any not set |
| PATCH  | `/api/planet/settings`                 | yes    | Change any of them (volumes 0 to 1, `reducedMotion` `auto`, `on` or `off`); 200 with all five; not a command, the version stays |
| DELETE | `/api/planet`                          | yes    | Delete it and all its data; needs `{ confirm: "DELETE" }`; 204   |
| POST   | `/api/garden/plants`                   | yes    | Plant a seed from `{ itemType, lat, lon }`; 201                  |
| POST   | `/api/garden/plants/:id/harvest`       | yes    | Pick 1 or 2 seeds from a ready bloom; 200, ready again in 1 h    |
| DELETE | `/api/garden/plants/:id`               | yes    | Dig it up; a seed or sprout goes back into the inventory         |
| POST   | `/api/garden/decorations`              | yes    | Place a decoration from `{ itemType, lat, lon }`; 201            |
| PATCH  | `/api/garden/decorations/:id/position` | yes    | Move it to `{ lat, lon }`                                        |
| DELETE | `/api/garden/decorations/:id`          | yes    | Put it away into the inventory                                   |
| POST   | `/api/garden/rain`                     | yes    | Rain from `{ cloudId, lat, lon, seconds }`; adds `cloudEmpty`    |
| POST   | `/api/garden/clouds/:id/position`      | yes    | Put a cloud down at `{ lat, lon }`; 200                          |
| POST   | `/api/garden/sun`                      | yes    | Hold the sun over `{ angle }`, 0 up to 360; 200                  |
| POST   | `/api/wants/:id/maybe-later`           | yes    | Put a creature's active want off; 200, mood unchanged            |
| GET    | `/api/creatures/:id/chat`              | yes    | A page of the chat, `?before=<ISO>&limit=1..50` (30); `{ messages, hasMore, remaining, greeting }` |
| POST   | `/api/creatures/:id/chat`              | yes    | Say `{ text }` to the creature; 201 `{ messages, remaining, limitReached }` |
| DELETE | `/api/creatures/:id/chat`              | yes    | Forget the chat and its highlights; 204                          |
| GET    | `/api/journal`                         | yes    | A page of the journal, newest first, `?before=<ISO>&limit=1..20` (10); `{ entries, hasMore }` |
| GET    | `/api/admin/settings`                  |        | `{ aiEnabled, aiDailyBudget, aiRequestsToday }`                  |
| PATCH  | `/api/admin/settings`                  |        | Change `{ aiEnabled?, aiDailyBudget? }` (an integer ≥ 0); 200 with the same shape |

On a planet-scoped route a missing or malformed `X-Planet-Id` is a 400 and an
unknown one is a 404 `This planet has drifted away`. The PoC has no accounts
and no authentication (decision D-0 in the plan): a player *is* a planet. The
browser keeps the planet's id in `localStorage` under `ppg.planetId` and sends
it as the `X-Planet-Id` header on every request, and that id is the player's
whole identity. Anyone who has a planet's id or code can open, change or
delete that planet. This must be replaced before anything beyond a PoC.

The client syncs every `GAME_SYNC_INTERVAL_SECONDS`. A sync advances the
planet to now and answers with the snapshot and the events that happened, but
it never bumps `version`: only the player's commands do. An `expectedVersion`
that is not the planet's current one is a 409 `reload` that changes nothing,
because another tab or device has changed the planet since.

Before every sync and command the plants grow from the planet's
`lastSimulatedAt` to now, in 15-minute slices on a fixed clock grid, with
the rules in `simulation/growth-rules.ts`. A gap of up to three sync
intervals is live play: each plant's light comes from where the sun is. A
longer gap is away time: every plant counts as getting average light, which
suits every preference, and at most `GAME_MAX_AWAY_DAYS` of it is simulated
(the rest is let go). Water falls by 0.03, 0.06 or 0.09 an hour for a low,
medium or high water preference; a plant is thirsty below 0.12, a bit
thirsty below 0.3, happy up to 0.95 and soggy above. Full sun wants a light
of at least 0.5, partial at least 0.1 (never too sunny), shade at most 0.3. Each unmet need
halves the speed (`GAME_UNMET_NEED_GROWTH_FACTOR`) and a thirsty plant stops.
Plants never die and never lose a stage. The sync's `events` report each
stage reached, dated when it happened: `plant-stage`
(`{ plantId, type, stage }`) for sprout and young, `plant-bloomed`
(`{ plantId, type, lat, lon }`) for bloom.

Every event of a sync or command is also appended to the planet's event log,
the `events` table, dated when it happened. The planet's first
`plant-bloomed` is marked `is_milestone`, as is any event whose payload says
`milestone: true`. A sync at least `GAME_SUMMARY_AFTER_MINUTES` (60) after
the previous sync also answers `welcomeBack: { summary }`, the news in the
log since that previous sync: one `{ kind, count, text, focus }` line per
kind, in the order `blooms` (`plant-bloomed`), `creatures`
(`creature-arrived`), `wants` (`want-fulfilled`), `gifts` (`gift-received`),
with `text` such as `3 plants bloomed` and `focus` the `{ lat, lon }` of the
latest one, left out when its events have no position. Stage changes are not
news. After a shorter gap, or with no news, the summary is empty, and unless
a journal entry was written (below) the sync has no `welcomeBack`;
`GET /api/planet` never has one.

A sync at least `GAME_JOURNAL_AFTER_HOURS` (4) after the previous sync also
writes the planet's journal (`journal/`), unless its latest entry is less
than that old, and answers it as `welcomeBack.journalEntry`, even after a
quiet day with an empty summary. An entry is
`{ id, text, source, createdAt, coversFrom, coversTo, milestones }`: the
story of the events logged after `coversFrom` (where the previous entry
stopped, at most `GAME_MAX_AWAY_DAYS` back) up to `coversTo` (now), with
`source` `ai` or `template` and `milestones` the milestone events in that
span as `{ type, label, occurredAt }`, labelled like `First bloom: clover` or
`Wigglenut the worm moved in`. The model is asked for at most
`GAME_JOURNAL_MAX_WORDS` (150) words, warm and funny, naming the creatures,
and an entry of up to a quarter more is accepted. `journal-fact-check.ts`
refuses one that names a creature the planet does not have (a name from the
fallback pool, or a name before "the snail" and the like), mentions a gift,
parcel, arrival, bloom or granted wish the log does not hold, or counts more
blooms than were logged. After the retry, or with the AI off, the entry is a
template written from the log, at most 150 words. `GET /api/journal` pages
the entries newest first: the latest `limit`, or those before `before` (pass
the oldest `createdAt` you have).

The snapshot is the whole planet. It keeps the fields served before it,
`id`, `code`, `name`, `version` and `createdAt`, so older clients still work,
and adds `radiusLevel`, `maxPlants`, `tutorialStep`, `serverTime`, `plants`,
`decorations`, `inventory` (only stacks with a count above 0), `unlocks`,
`clouds` (`{ id, lat, lon, water, at }` each, see below), `sun`
(`{ overrideAngle, overrideAt, angle }`, `angle` being the
longitude in degrees the sun stands over at `serverTime`) and `creatures`
(see below). Plants and decorations
come oldest first; inventory and unlocks are sorted by item type. A new
planet holds the first `GAME_STARTER_SEED_TYPES` seed stacks of
`content/starter.ts`, already unlocked, and no decorations.

Every garden command also sends `expectedVersion` in its body and answers
`{ snapshot, events, newlyUnlocked }`. Positions are degrees, `lat` -90..90
and `lon` -180..180. A refused command is a 400
`{ statusCode, message, reason }`, with `reason` one of `occupied-plant`,
`occupied-decoration`, `occupied-water`, `planet-full` or `not-owned` and
`message` a friendly sentence to show the player; the planet, its version and
its inventory stay as they were. A plant or decoration id that is not on the
planet is a 404.

A planet gets its clouds at its first sync or command. Each stored cloud is
where it was, with how much water it held (0 to 1), at the instant `at`; it
drifts east from there at a steady pace on its latitude and refills evenly to
full in `GAME_CLOUD_REFILL_SECONDS`, and `cloudAt` in
`simulation/cloud-rules.ts` (copied to the frontend) works out where it is
later. Every sync and command stores the clouds as they are at that moment.
The sky commands answer 200. `rain` moves the cloud to the spot and, for
`seconds` from just above 0 to 2, rains for as long as its water lasts, and
each plant within the rain radius gains the water for the seconds it rained,
up to 1. From an empty cloud nothing falls and the answer carries
`cloudEmpty: true`. Moving a cloud puts it down where it drifts on from. `sun`
holds the sun over `angle` for `GAME_SUN_OVERRIDE_MINUTES`, then it drifts on
from there. An unknown cloud id is a 404.

Creatures move in by themselves (`creatures/`). After every sync and command
the arrival conditions of `content/species.ts` are checked against the
blooming plants and the placed decorations, and `arrival_tracking` on the
planet keeps since when each one has held. A species is due once its
condition has held for `GAME_ARRIVAL_DELAY_SECONDS` (120), or at once when
the sync ends away time (a gap of more than three sync intervals) or when
the planet has never had a creature, so the worm comes with the very sync
that finds the first bloom (ONB-02). At most
one creature arrives at a time, the first due species in content order, and
none within `GAME_ARRIVAL_SPACING_MINUTES` (30) of the last arrival, while
the planet has `GAME_MAX_CREATURES` (8), or for a species that already has
`GAME_MAX_PER_SPECIES` (2). The worm's condition is the first bloom, so it
brings one worm only. A new creature makes its home on a free spot near what
drew it (the pond, its clovers), gets its identity from the model through
the gateway, or from `content/fallback-identities.ts` when that fails, and
starts `content`. The arrival is a `creature-arrived` event
(`{ creatureId, species, name, lat, lon, milestone: true }`). The snapshot's
`creatures` are `{ id, species, name, summary, traits, quirk, speakingStyle,
backstory, mood, wistful, lat, lon, arrivedAt, identitySource, want }` each,
oldest first. Nothing removes a creature except deleting its planet.

Creatures ask for things (`wants/`). `want` is the creature's active want,
`{ id, type, text, plainDescription, spec }`, or `null`: `text` in the
creature's own voice, `plainDescription` such as `2 clovers in bloom`, and
`spec` the condition (`wants/want-evaluator.ts`). After every sync and
command, in this order:

- An active want whose condition holds is fulfilled: the creature's mood goes
  up one level (`content`, `cheerful`, `overjoyed`, no higher), it remembers
  the wish (`creature_memories`), the planet gets a reward of one or two item
  types straight into the inventory, and a `want-fulfilled` event
  (`{ creatureId, name, species, lat, lon, wantText, thankYou, reward }`)
  carries a scripted thank-you line from `content/thank-you-lines.ts`. Every
  `GAME_UNLOCK_EVERY_N_REWARDS`-th (3rd) reward holds an item the planet has
  never had while any is left; the others are seeds of unlocked plants, now
  and then an unlocked decoration.
- A creature is `wistful` while its species' arrival condition no longer
  holds, for example after its pond was put away.
- One creature without a want gets a new one from the model through the
  gateway, or from `content/fallback-wants.ts`: one that never had a want at
  once, otherwise `GAME_WANT_COOLDOWN_MINUTES` (60) after its last want was
  fulfilled or put off. At most one want is made per sync or command, and
  none in the one that brought a creature, so the next sync gives it.
  The planet's first want can be met with the seeds it holds; a wistful
  creature asks for its missing decoration, or a plant type of which none is
  left, back.

Wants never expire. `maybe-later` puts the active want off without changing
the mood and starts the cooldown again; a want that is not this planet's
active one is a 400 with `reason` `not-waiting`. A creature that has been
`overjoyed` for `GAME_OVERJOYED_GIFT_HOURS` (24) gives one gift of an unlocked
item, a `gift-received` event (`{ creatureId, name, species, lat, lon, item }`)
dated when it was due, and is `cheerful` again. A reward or gift that brings
a type the planet has never had unlocks it and lists it in `newlyUnlocked`,
in a sync's answer as in a command's.

The player can chat with each creature (`chat/`). A chat is not a command:
it carries no `expectedVersion`, never changes the planet or its version,
and the model is never asked while the planet is locked. A creature that is
not on the planet is a 404 `That creature isn't on your planet.` Messages
are `{ id, role, text, createdAt, source?, link? }`, `role` being `user`,
`creature` or `notice` and `source` (not on the player's own) `ai`,
`fallback` or `scripted`. `GET` answers a page of history, oldest first:
the latest `limit` messages, or those before `before` (pass the oldest
`createdAt` you have); `hasMore` says older ones exist. Its `greeting` is a
scripted line from `content/chat-lines.ts` in the creature's voice, not
stored. `POST` takes 1 to `GAME_CHAT_MESSAGE_MAX_CHARS` (200) characters
after trimming, counted as code points; outside that it is a 400 with
`reason` `empty` or `too-long` and a friendly `message`. It stores the
player's message and answers the new messages in order: the player's, a
`notice` if the message suggests the player may be in danger, and the
creature's answer. The answer comes from the model, written with the
creature's identity, mood, its latest memories, the planet's recent notable
events (not growth steps), the planet as it is and the last 10 turns of this
chat. The prompt asks for at most `GAME_CHAT_ANSWER_MAX_WORDS` (60) words;
an answer of up to a quarter more (75) is still accepted, with no limit on
sentences. A sad message asks the model to answer gently; one that suggests danger adds
the notice, with `link: { label: 'Find a helpline', url }` (`SUPPORT_URL`,
default `https://findahelpline.com`), and asks for a kind answer with no game
banter. When the gateway falls back, the creature has dozed off mid-thought
(or, after a danger message, answers with a kind line). Every 5th player
message to a creature, the model is asked for one short highlight of the
recent chat, kept as a `chat` memory (`creature_memories`); nothing is kept
when it finds nothing worth remembering or the answer was a fallback.
`remaining` is what is left of `GAME_CHAT_DAILY_LIMIT` (30) player messages
a day, from midnight UTC, across all the planet's creatures. They are
counted from the planet's `chat` rows in `ai_usage` (one per answered
message, fallbacks included), so forgetting chats gives none back. Over the
limit, `POST` stores and logs nothing, asks no model and answers the
creature's sleepy line with `limitReached: true` and `remaining: 0`.
`DELETE` removes the creature's chat and its `chat` memories; memories of
wants, events and stories stay.

Every AI feature goes through `AiGatewayService.generate()` in `ai/`, never
straight to `AiService`. It uses the feature's pre-written fallback instead
of the model when the AI switch is off, when today's budget is used up, when
the model takes longer than `GAME_AI_TIMEOUT_MS` (15 s, for both tries
together; `AI_TIMEOUT_MS` is only the adapter's own ceiling) or fails, or
when the reply, after one retry that names the problem, still has the wrong
form or breaks the content rules (`ai/content-rules.ts`). It never shows the
player an error. Each call logs one row in `ai_usage` with the feature, the
planet, whether the fallback was used and why, and the latency.

The admin settings are the AI switch, `aiEnabled` (default `true`), and the
game-wide daily budget, `aiDailyBudget` (default 1000). The budget counts
gateway calls a day, from midnight UTC, that the model answered without a
fallback; a call with a retry counts once. The SD leaves the budget to the
game owner (open question Q-8), so 1000 is a stand-in. The settings are
cached for a minute: a change made through `PATCH /api/admin/settings`
applies to the next request, one made straight in the `admin_settings` table
within a minute. **The admin routes are open to anyone** in the PoC, as is
the admin view (`?admin=1`): there are no accounts to tell the game owner
apart (decision D-0).

Pip's tutorial (`tutorial/`, script in `content/tutorial.ts`) has 8 steps,
`welcome`, `rotate`, `open-inventory`, `plant`, `water`, `move-sun`,
`inspect` and `goodbye`; a step's number is its index, and `highlight` is
`canvas`, `inventory`, `sky`, `card` or `none`. The snapshot's
`tutorialStep` is the step reached, 0 on a new planet and -1 once finished
or skipped. `PATCH /api/planet/tutorial` takes a later step up to the last,
-1 from any step, or 0 when the step is -1 (a restart); anything else,
including the current step, is a 400 with a friendly `message`. It is not a
command: no `expectedVersion`, and the version stays as it is.

A planet name must be 2 to 24 characters (`GAME_PLANET_NAME_MIN` and
`GAME_PLANET_NAME_MAX`) and pass a small offensive-word filter. A refused
name is a 400 whose `message` is a friendly sentence to show the player.

Services read the time from `ClockService`, never from `new Date()`. An e2e
test can run a request at a fixed instant by sending an `X-Test-Now` header
with an ISO timestamp, e.g. `X-Test-Now: 2030-01-01T00:00:00.000Z`. The
header is test-only: it is honoured only when `NODE_ENV=test` (Jest sets it)
and ignored everywhere else. Under test, a timestamp without `Z` or an offset
is a 400.

```bash
cd backend
npm test                 # unit specs
npm run test:e2e         # e2e specs, against the dev database
```

`npm run test:e2e` uses the database in `backend/.env` and empties its
`planets` table, and with it every table that cascades from it; some specs
also empty `ai_usage` and `admin_settings`. Planets you created while playing,
and the seeded full planet below, are gone afterwards.

Two dev-only scripts run from `backend/` against the same `.env`:

```bash
npm run seed:full-planet   # one new planet filled to the limits, for the performance run
npm run tone:sample        # samples the real model's answers for the tone review
```

- `seed:full-planet` (`scripts/seed-full-planet.ts`) creates "Full Bloom" with
  `GAME_MAX_PLANTS` plants in mixed stages, one of each decoration,
  `GAME_MAX_CREATURES` creatures with pre-written identities and the clouds.
  It never asks the model and refuses to run with `NODE_ENV=production`. It
  prints the planet's id and code; open the planet in the browser with
  `localStorage.setItem('ppg.planetId', '<id>')` and a reload.
- `tone:sample` (`scripts/tone-sample.ts`) sends requests for each AI
  feature through the real feature services and the real gateway, then runs
  the content rules over every answer. It writes nothing to the database.
  **It makes real model calls**: about 300 with the defaults (50 per feature
  for 5 features, plus retries). The options are `--samples=` (default 50),
  `--features=` (a comma list of `identity`, `want`, `chat`, `memory` and
  `journal`; default all) and `--out=` (default
  `docs/plans/2026-10-01-pocket-planet-gardener-poc-tone-sample.md`), passed
  after `--`, e.g. `npm run tone:sample -- --features=want --samples=10`.

`scripts/` is left out of `tsconfig.build.json`, so `nest build` still puts
the app at `dist/main.js`; `npx tsc --noEmit -p tsconfig.json` type-checks the
scripts too.

## 3. Frontend

```bash
cd frontend
npm install
npm start                # http://localhost:4301
```

`proxy.conf.json` forwards `/api` to `http://localhost:3101`, so the frontend
never hardcodes the backend host.

```bash
npx ng test --watch=false   # vitest specs in jsdom (no WebGL); there is no lint script
```

Opening the page goes straight to the planet whose id is in `ppg.planetId`,
or to create-planet when there is none. Besides the planet, the page has the
garden list, the sky list, the inventory and the menu buttons Catalogue,
Journal, Settings and Shortcuts.

- **Settings** are kept with the planet (`/api/planet/settings`), so they
  follow it to another device. Music and sound effects each have a volume and
  a mute, heard at once. The sounds are made in code with Web Audio (no sound
  files) and start only after the first click or key press. Reduced motion is
  `Auto (follow my device)`, `On` or `Off`; when reduced, idle animation,
  camera swoops and spin, and celebrations stand still or only fade, and the
  rain streaks stop.
- **Keyboard-only play.** With the planet focused, the arrow keys or W A S D
  turn it, `+` and `-` zoom, and Enter plants, places or opens a card at the
  ring in the middle of the view. Tab goes on to the garden list (arrows pick
  a plant, decoration or creature, Enter opens its card), the sky list (arrows
  move a cloud or the sun, Space rains), the inventory and the menus. `?`
  anywhere except while typing lists every key; Esc closes a card or panel.
- **Admin page.** `http://localhost:4301/?admin=1` opens the game owner's
  page with the AI switch and the daily budget. Like the admin routes, it is
  open to anyone (D-0).
- **Performance lines.** With `?perf=1` the page logs developer lines that
  start `[ppg perf]` through `console.info`: the frame rate every 5 s, such as
  `[ppg perf] fps avg 58.2 min 41.0 over 5 s`, and once for a returning
  player `[ppg perf] planet visible after 1234 ms`. The frame-rate meter
  makes the scene draw every frame, which it otherwise does only on demand,
  so leave `?perf=1` off for normal play and the browser smoke list. Without
  the flag, a returning player's start is still timed: the User Timing mark
  `ppg:planet-visible` and the measure `ppg:time-to-planet`, which runs from
  the start of the navigation to that mark. Measure with the production build
  (`npx ng serve --configuration production`), not the development one.

## Layout

```
backend/src
├── app.module.ts            root module: config, TypeORM, feature modules
├── app.setup.ts             global /api prefix, validation pipe
├── main.ts                  bootstrap, CORS
├── common/                  ClockService, RandomService, X-Test-Now middleware (global)
├── game-config/             GameConfigService (GAME_* tunables), GET /api/config
├── content/                 game data as code: plants, decorations, species,
│                            starter seeds, Pip's script, fallback identities and
│                            wants, chat and thank-you lines, blocked words and
│                            names; tone-review.spec.ts checks all its text
├── catalogue/               GET /api/catalogue, the public view of content/
├── planets/
│   ├── planet.entity.ts     the planets table; a planet is also the player (D-0)
│   ├── planets.controller.ts  the /api/planet routes
│   ├── planets.service.ts   create, get, rename, open by code, delete
│   ├── planet-code.ts       8-character planet codes (pure helper)
│   ├── name-rules.ts        length and offensive-word checks for names (pure helper)
│   ├── player-settings.service.ts  GET/PATCH /api/planet/settings (audio, reduced motion)
│   ├── settings-rules.ts    player settings defaults and merging (pure helper)
│   ├── dto/
│   ├── planet-state/        the snapshot and mutate(), the one path every command takes (D-2)
│   └── planet-context/      PlanetGuard (X-Planet-Id), @CurrentPlanet(), @NoPlanet()
├── simulation/              SimulationService (growth before every sync and command)
│                            and pure rules: growth, sun, clouds, surface coords, placement
├── garden/                  GardenService, the /api/garden routes: plant, dig up, harvest,
│                            decorations, rain, clouds, sun
├── inventory/               InventoryService: items and unlocks
├── events/                  EventLogService (the events table), ReturnService
│                            (welcomeBack) and the pure summary helper
├── database/
│   ├── data-source.ts       DataSource for the TypeORM CLI, MIGRATIONS list
│   └── migrations/
├── creatures/               CreaturesService (arrivals after every sync and command,
│                            creatures in the snapshot), IdentityService, and pure
│                            rules: arrival conditions, home spot
├── wants/                   WantsService (fulfilment, mood, gifts, new wants after every
│                            sync and command; maybe-later), WantGenerationService,
│                            RewardService, and pure rules: want evaluator, mood, rewards
├── chat/                    ChatService (/api/creatures/:id/chat), MemoryService
│                            (highlights), and pure helpers: the prompt, limits, wellbeing
├── journal/                 JournalService (an entry on return, GET /api/journal) and
│                            pure helpers: the journal prompt, fact check and template
├── tutorial/                GET /api/tutorial (Pip's script), PATCH /api/planet/tutorial,
│                            and the pure step rule (tutorial-rules.ts)
├── admin/                   GET/PATCH /api/admin/settings: AdminSettingsService
│                            (AI switch, daily budget) and AiUsageService (ai_usage log)
└── ai/
    ├── ai.module.ts         exports only the gateway
    ├── ai-gateway.service.ts  the one path to the model: switch, budget, timeout,
    │                          checks, one retry, fallback, usage log; extractJson
    ├── ai.service.ts        OpenAI-compatible adapter (no routes)
    ├── ai.types.ts
    ├── content-rules.ts     content and tone checks for AI text (pure helper)
    └── prompt-context.ts    prompt builders that take only public game state

backend/scripts/             dev-only: seed-full-planet.ts, tone-sample.ts (section 2)
backend/test/                e2e specs; support/ boots the app with the fake model,
                             readme-routes.e2e-spec.ts checks the endpoint table

frontend/src/app
├── app.ts / app.html        root App: shows one view at a time (no router); the
│                            admin page loads as a lazy chunk
├── app.config.ts            HttpClient, loads the game config at startup
├── core/
│   ├── models/              mirrors of the backend DTOs: snapshot, creature, want,
│   │                        chat, journal, catalogue, player settings, game config
│   ├── services/
│   │   ├── api.service.ts               /api prefix, adds X-Planet-Id
│   │   ├── planet-identity.service.ts   the planet id in localStorage (ppg.planetId)
│   │   ├── view-state.service.ts        current view, ?admin=1, returning player
│   │   ├── game-config.service.ts       the tunables from /api/config
│   │   ├── planet.service.ts            create, open, rename, leave, delete
│   │   ├── planet-store.service.ts      the loaded planet and its save state
│   │   ├── sync.service.ts              heartbeat and gameplay commands
│   │   ├── placement.service.ts         what the next tap puts down; the info card
│   │   ├── settings.service.ts          audio and reduced motion, /api/planet/settings
│   │   ├── audio.service.ts             music and sound effects (Web Audio)
│   │   ├── motion-preference.service.ts reduced motion: the setting, else the device
│   │   ├── tutorial.service.ts          Pip's steps
│   │   └── …                            catalogue, chat, journal, admin, receipts,
│   │                                    reward reveals, celebrations
│   └── helpers/             client copies of the shared pure rules (byte-identical to
│                            the backend's; a backend spec fails on drift), status text,
│                            the nap rule, perf.ts (?perf=1, time-to-planet marks)
├── scene/                   three.js: SceneService, camera controls, input and picking,
│                            meshes for the planet, plants, decorations, creatures and
│                            sky, the selection ring and placement ghost; SCENE_RENDERER
│                            token and NullSceneRenderer for specs; fps-meter.ts (?perf=1)
├── testing/                 spec helpers: axe.ts, fake motion and audio, the full-planet
│                            fixture, a three.js allocation counter
└── ui/                      one folder per screen or panel: create-planet, planet-page,
                             inventory, garden and sky lists, info and creature cards,
                             chat, catalogue, journal book and page, welcome-back, Pip,
                             settings, shortcut help, admin, and smaller pieces
```
