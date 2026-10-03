# Pocket Planet Gardener — Implementation Plan (PoC, Must-have scope)

| | |
|---|---|
| **Source** | `docs/pocket-planet-gardener-SD.md` v0.1 |
| **Date** | 1 October 2026 |
| **Scope** | The 53 Must requirements and the Must NFRs. Should/Could items are listed in Appendix A, not planned. |
| **Nature** | Proof of concept. No authentication or authorisation (see Decision D-0). |
| **Stack** | NestJS 11 + TypeORM + Postgres (backend, port 3101), Angular 21 standalone/signals/zoneless + three.js (frontend, port 4301). |
| **Progress** | Phases 1–14 implemented and validated (see section 9). Next: Phase 15. |

---

## 1. Overview

The repo is a scaffold: a NestJS backend with one working `AiService` adapter and a placeholder global chat, and an Angular frontend with a single chat page. Everything game-related is new. This plan turns the solution description into 17 phases, each a set of tasks with acceptance criteria, in dependency order. Every phase ends with the same exit gates (section 5) plus its own functional checks.

The architecture is **service-oriented**: one NestJS feature module per area, each with a thin controller, a service holding all logic and data access, and DTOs. Game rules live in **pure helper modules** (plain exported functions, no Nest, no database) that services call and that are unit-tested on their own. The frontend mirrors this: Angular services own state and the three.js scene; components only render and dispatch.

## 2. Decisions and assumptions

Answers from the product owner on 1 Oct 2026 are marked **(PO)**.

| ID | Decision |
|---|---|
| D-0 | **No security (PO).** No accounts, passwords or sessions. A player *is* a planet. The browser stores the planet id in `localStorage` and sends it as the `X-Planet-Id` header on every request. "Continue on another device" = type the planet code shown in settings. Admin endpoints are open and the admin view opens with `?admin=1`. ACC-01, ACC-05, ADM-01 AC3 and NFR-08 are reinterpreted accordingly (section 4). Must be replaced before anything beyond a PoC. |
| D-1 | **Server-authoritative simulation.** Every player action is a validated command. Before applying it, the server advances the planet from `lastSimulatedAt` to now with pure rule functions. Away-time catch-up (TIM-01) is the *same code path* with a 7-day cap (TIM-02). The client runs copies of some pure helpers for previews and visual interpolation only. |
| D-2 | **One mutation backbone.** `PlanetStateService.mutate(planetId, expectedVersion, apply)` opens a transaction, locks the planet row, runs simulation steps, checks the version (409 on mismatch, ACC-04 AC2), applies the command, runs post-mutation evaluators (arrivals, wants), appends events, bumps `version`, returns a snapshot. Every gameplay service uses it; none touch repositories directly inside a command. |
| D-3 | **Heartbeat sync, no websockets.** `POST /api/planet/sync { expectedVersion }` every 10 s (tunable) advances the simulation and returns snapshot + new events. Covers "within a few seconds" wording in WNT-03 and CRT-01. |
| D-4 | **`AiGatewayService` in front of `AiService`.** The only path to the model: kill switch → budget → call with 15 s timeout → parse → content-rule validation → one retry → fallback → usage log. Never throws to callers. All AI features (identity, wants, chat, memory highlights, journal) go through it. |
| D-5 | **Content as code.** Plant types, decorations, species, arrival conditions, fallback pools, Pip's script and blocked words are typed TS files under `backend/src/content/`, checked by a content spec. Tunables (§11 of the SD) are read by `GameConfigService` from `GAME_*` env vars with the SD defaults. |
| D-6 | **No router.** `ViewStateService` holds a `view` signal (`'create-planet' \| 'planet' \| 'admin'`). Per CLAUDE.md. |
| D-7 | **Plain three.js in Angular services.** No wrapper library. Renderer access sits behind a `SCENE_RENDERER` injection token so component specs (jsdom, no WebGL) inject a `NullSceneRenderer`. |
| D-8 | **Procedural low-poly meshes (PO).** All plants, decorations, creatures, clouds and the sun are built from three.js primitives in code. No GLTF pipeline. |
| D-9 | **Delete the placeholder chat (PO).** `backend/src/messages`, the `messages` table and the frontend chat page go in Phase 1. `AiService`, `FakeAiService` and `bootWithFakeAi` stay. |
| D-10 | **Pure helpers duplicated front/back where both need them** (`surfaceCoords`, `growthRules`, `placementRules`). Both copies share a fixture table in their specs so drift fails a test. A shared npm package was rejected to keep the two projects independent. |
| D-11 | **Test clock.** All services take time from `ClockService`. e2e tests advance time with an `X-Test-Now` header that the server honours only when `NODE_ENV=test`. |
| D-12 | **Profanity and famous-name checks** use small in-repo word lists. AI budget counts requests per day, not tokens. |

## 3. Architecture

### 3.1 Backend modules (`backend/src/<module>/`)

Each has `*.module.ts`, `*.controller.ts` (where it has routes), `*.service.ts`, `dto/`, and `*.spec.ts`.

| Module | Responsibility | Key services |
|---|---|---|
| `common` | Cross-cutting plumbing | `ClockService`, `RandomService`, `PlanetContext` (reads `X-Planet-Id`, `@CurrentPlanet()` decorator) |
| `game-config` | §11 tunables | `GameConfigService` |
| `content` | Static game data (no module, plain TS) | — |
| `catalogue` | Public read API for content | `CatalogueService` |
| `planets` | Planet lifecycle, snapshot, mutation backbone, sync | `PlanetsService`, `PlanetStateService`, `SyncService` |
| `simulation` | Pure rules + `advance()` | `SimulationService` + helpers |
| `garden` | Plant, dig up, decorations, rain, sun, harvest | `GardenService` |
| `inventory` | Items, unlocks, rewards | `InventoryService`, `RewardService` |
| `events` | Event log, welcome-back summary | `EventLogService`, `ReturnService` |
| `ai` | Adapter (exists), gateway, content rules, usage | `AiService`, `AiGatewayService`, `AiUsageService` |
| `creatures` | Arrival, identity, mood | `CreaturesService`, `IdentityService` |
| `wants` | Want generation, evaluation, fulfilment | `WantsService`, `WantGenerationService` |
| `chat` | Per-creature chat, memory | `ChatService`, `MemoryService` |
| `journal` | Diary entries | `JournalService` |
| `tutorial` | Tutorial step persistence | (in `planets`, no separate module) |
| `admin` | AI switch and settings | `AdminSettingsService` |

### 3.2 Pure helper modules (no Nest, unit-tested in isolation)

| Helper | Functions |
|---|---|
| `simulation/surfaceCoords.ts` | `toVector(lat, lon, r)`, `fromVector(v)`, `angularDistance(a, b)`, `stepsBetween(a, b)` |
| `simulation/growthRules.ts` | `waterStatus(level)`, `lightStatus(pref, exposure)`, `growthMultiplier(statuses)`, `advancePlant(plant, dt, light, cfg)` |
| `simulation/sunModel.ts` | `sunAngleAt(t, override?)`, `lightAt(lat, lon, sunAngle)`, `averageLight()` |
| `simulation/cloudRules.ts` | `drift(cloud, dt)`, `drain(cloud, seconds)`, `refill(cloud, dt, refillSeconds)` |
| `garden/placementRules.ts` | `canPlaceAt(snapshot, point, footprint)`, `isPlanetFull(snapshot, cfg)` |
| `creatures/arrivalConditions.ts` | `evaluateArrivals(snapshot, tracking, now, cfg)` |
| `wants/wantEvaluator.ts` | `evaluate(want, snapshot)`, `isAchievable(want, snapshot, unlocks)`, `describe(want)`, `dependsOn(want, plantId)` |
| `ai/contentRules.ts` | `checkText(text, opts)`, `wordCount(text)` |
| `ai/promptContext.ts` | Type-restricted prompt builders (accept only public game state) |
| `planets/nameRules.ts` | `validateName(name, {min, max})` |
| `events/eventSummary.ts` | `summarise(events)` |
| `journal/journalFactCheck.ts` | `verify(text, events, snapshot)`, `templateEntry(events, snapshot, date)` |
| `chat/wellbeing.ts` | `detectDistress(text)` |

### 3.3 Frontend (`frontend/src/app/`)

| Folder | Contents |
|---|---|
| `core/services/` | `ApiService`, `PlanetIdentityService` (localStorage planet id), `ViewStateService`, `PlanetStore`, `SyncService`, `PlacementService`, `TutorialService`, `MotionPreferenceService`, `AudioService`, `CelebrationService`, feature API services (`GardenApi`, `CreaturesApi`, `ChatApi`, `JournalApi`, `AdminApi`) |
| `core/models/` | DTO mirrors: `PlanetSnapshot`, `Plant`, `Creature`, `Want`, `ChatMessage`, `JournalEntry`, `GameConfig` |
| `core/helpers/` | Client copies of `surfaceCoords`, `growthRules`, `placementRules`; `statusText.ts`, `humanDuration.ts`, `waitingLine.ts` |
| `scene/` | `SceneService`, `CameraControlsService`, `InputService`, `PickingService`, `PlanetMeshService`, `PlantMeshService`, `DecorationMeshService`, `CreatureMeshService`, `SkyService`, `SCENE_RENDERER` token + `NullSceneRenderer` |
| `ui/` | One folder per screen or panel: `create-planet`, `planet-page`, `hud`, `inventory-panel`, `info-card`, `creature-card`, `chat-panel`, `catalogue`, `journal`, `welcome-back`, `pip`, `settings`, `admin`, `loading` |

### 3.4 Persistence (added migration by migration)

`planets`, `plants`, `decorations`, `inventory_items`, `unlocks`, `events`, `creatures`, `wants`, `creature_memories`, `chat_messages`, `journal_entries`, `admin_settings`, `ai_usage`. All child tables `ON DELETE CASCADE` from `planets` so delete-planet (ACC-05) is one statement.

## 4. Requirement reinterpretations under D-0

| Requirement | PoC reading |
|---|---|
| ACC-01 Sign in | "Open planet": if `localStorage` holds a planet id and the server knows it, land on the planet; otherwise show create-planet / enter-code. "Sign out" = "Leave this planet" clears `localStorage`. |
| ACC-04 Another device | Settings shows the planet code; entering it on another device opens the same planet. Two-device conflict is still 409 → reload. |
| ACC-05 Delete account | "Delete my planet" with double confirm removes the planet and all cascaded rows. |
| ADM-01 AC3 No admin access for players | Not enforced. Admin view hidden behind `?admin=1`; endpoints open. Documented limitation. |
| NFR-06 Privacy | No personal data is stored at all (no email, no name beyond the planet name). |
| NFR-08 Tamper-proof shared actions | Game rules are still validated server-side; player separation is not. |

## 5. Standard exit gates (every phase)

- **Build:** `backend`: `npm run build`, `npm run lint`, `npx tsc --noEmit -p tsconfig.json`; `frontend`: `npm run build`. Zero errors or warnings beyond the known bundle-size warning handled in Phase 1.
- **Tests:** `npm test` in both projects and `npm run test:e2e` in `backend/` green. Check exit codes, not piped output.
- **Runtime:** backend `start:dev` answers on 3101 with no startup errors; frontend `npm start` serves 4301 with no console errors. Health check both before any live verification (memory reaper).
- **Migrations:** `npm run migration:run` applies cleanly on `epikrise-demo`; `migration:revert` undoes the phase's migration.
- **Phase checks:** the functional checks listed at the end of each phase, run and output recorded.
- **UI phases:** a Playwright screenshot of the new screen.

---

## 6. Phases

### Phase 1 — Foundation

**Objective.** Both projects ready for the game: placeholder chat gone, config, clock, three.js, planet identity plumbing.
**Requirements touched.** None directly; enables all.

- **Task 1.1 — Remove the placeholder chat (D-9).** Delete `backend/src/messages/**`, `backend/test/messages.e2e-spec.ts`, `frontend/src/app/core/services/message.service.ts`, `core/models/message.ts`, and the chat markup/state in `app.html`, `app.ts`, `app.scss`, `app.spec.ts`. New migration `DropMessages` (down recreates the table). Remove `Message` from `data-source.ts` entities and `MessagesModule` from `AppModule`. Update README endpoint table.
  **AC:** `git grep -il "message" backend/src frontend/src` returns only `ai/` files (the `ChatMessage` type); backend boots; `curl /api/messages` → 404; `migration:revert` recreates `messages`; `npm test` green in both projects.
- **Task 1.2 — `GameConfigService` (`backend/src/game-config/`).** One typed getter per §11 tunable (`maxPlants`, `cloudRefillSeconds`, `sunOverrideMinutes`, `unmetNeedGrowthFactor`, `seedsPerHarvest`, `harvestCooldownMinutes`, `starterSeedTypes`, `arrivalDelaySeconds`, `arrivalSpacingMinutes`, `maxCreatures`, `maxPerSpecies`, `overjoyedGiftHours`, `wantCooldownMinutes`, `unlockEveryNRewards`, `chatMessageMaxChars`, `chatAnswerMaxWords`, `aiTimeoutMs`, `chatDailyLimit`, `maxAwayDays`, `summaryAfterMinutes`, `journalAfterHours`, `journalMaxWords`, `syncIntervalSeconds`, `planetNameMin/Max`), each read from `GAME_<SNAKE_NAME>` via `ConfigService` with the SD default. `GET /api/config` returns the client-relevant subset.
  **AC:** spec built with a stub `ConfigService` (same idiom as `ai.service.spec.ts`) asserts every default equals §11; an env override is honoured; `.env.example` lists every `GAME_*` key with an empty value; `curl /api/config` → 200 JSON without `aiTimeoutMs`.
- **Task 1.3 — `ClockService` and `RandomService` (`backend/src/common/`).** `now(): Date`; `int(min, max)`, `pick(arr)`. `FakeClock` and `SeededRandom` in `test/support/`. `X-Test-Now` middleware (D-11) sets the request clock only when `NODE_ENV=test`.
  **AC:** `FakeClock.advance(ms)` changes `now()` in a spec; e2e: header honoured under test env; a spec asserts middleware ignores the header when `NODE_ENV !== 'test'`; grep for `new Date()` in `backend/src` hits only `clock.service.ts` and entity default columns.
- **Task 1.4 — Planet context (`backend/src/common/planet-context`).** Middleware reads `X-Planet-Id`; `@CurrentPlanet()` param decorator returns the planet id; `PlanetGuard` returns 404 `{ message: 'This planet has drifted away' }` for unknown ids and 400 when the header is missing on planet-scoped routes. `@NoPlanet()` opt-out for `/api/config`, `/api/catalogue`, `POST /api/planet`, admin.
  **AC:** e2e: planet route without header → 400; with unknown uuid → 404 with the message; `/api/config` works without header.
- **Task 1.5 — Install three.js, raise bundle budget.** `NODE_OPTIONS=--use-system-ca npm install three @types/three`; `ng config` initial budget to 1.5 MB warning / 2.5 MB error. Create `src/app/scene/` with `SCENE_RENDERER` token and `NullSceneRenderer`.
  **AC:** `import * as THREE from 'three'` compiles; `npm run build` succeeds with no budget error; `package.json`/`angular.json` diffs contain only tool-written changes.
- **Task 1.6 — Frontend plumbing.** `ApiService` (base `/api`, attaches `X-Planet-Id` from `PlanetIdentityService`), `PlanetIdentityService` (`planetId` signal backed by `localStorage`, `set`, `clear`), `ViewStateService` (`view` signal, `?admin=1` detection), `GameConfig` model loaded on boot.
  **AC:** spec: no stored id → view `create-planet`; stored id → view `planet`; `?admin=1` → view `admin`; every `ApiService` request carries the header when an id exists.

**Functional checks.** `curl /api/config` → 200; `curl /api/messages` → 404; `curl -H "X-Planet-Id: 00000000-0000-0000-0000-000000000000" /api/planet` → 404 drifted message.

---

### Phase 2 — Content catalogue and planet creation

**Objective.** Typed game content exists; a player creates, names, renames, reopens and deletes exactly one planet.
**Requirements.** ACC-01, ACC-02, ACC-04 (code), ACC-05, ITM-03 (data), CRT-01 (data).

- **Task 2.1 — Content data (`backend/src/content/`).** `plants.ts` (clover, sunflower, tulip, bluebell, moonflower, mushroom, fern, cactus: `waterPref`, `lightPref`, `bloomMinutes`, `description`, `unlockHint`), `decorations.ts` (pond, rock, lamp-post, bench, tiny house: `footprintSteps`, `description`), `species.ts` (worm, snail, bee, moth, hedgehog, frog: typed `arrivalCondition`, `hint`), `starter.ts` (3 seed types with counts; clover `bloomMinutes ≤ 10`), `blocked-words.ts`, `blocked-names.ts`.
  **AC:** `content.spec.ts` asserts ≥8 plants, ≥5 decorations, ≥6 species, unique ids, every arrival condition references existing ids, at least one starter plant blooms in ≤10 min, every description ≤2 sentences.
- **Task 2.2 — `CatalogueController` `GET /api/catalogue`.** Plants, decorations, species in public shape (no fallback pools, no blocked words).
  **AC:** e2e: 200 with three arrays; plant entries carry `bloomMinutes`, `waterPref`, `lightPref`; species carry `hint`.
- **Task 2.3 — `Planet` entity + migration `PlanetSchema`.** `planets(id uuid, code char(8) unique, name, radius_level int default 1, max_plants int, version int default 1, last_simulated_at, last_seen_at, sun_override_angle numeric null, sun_override_at null, tutorial_step int default 0, clouds jsonb, arrival_tracking jsonb, reward_counter int default 0, created_at)`. Add to `MIGRATIONS`.
  **AC:** up/down clean; `code` unique index; entity uses `Relation<T>` for later relations.
- **Task 2.4 — `nameRules.ts`.** `validateName(name, {min, max})` → `ok | too-short | too-long | offensive`; normalises case, leet substitutions and repeated letters; word-boundary matching.
  **AC:** unit: 2-char name ok at min 2; 1-char rejected; 25-char rejected at max 24; a listed word and its l33t variant rejected; a word that merely contains a blocked substring (Scunthorpe case) passes.
- **Task 2.5 — `PlanetsService` + `PlanetsController`.** `create(name)` → planet with generated 8-char code; `rename(id, name)`; `get(id)`; `getByCode(code)`; `delete(id)` (cascade). Routes: `POST /api/planet`, `GET /api/planet`, `PATCH /api/planet/name`, `GET /api/planet/by-code/:code` → `{ id }`, `DELETE /api/planet { confirm: 'DELETE' }`.
  **AC:** e2e: create → 201 with `id`, `code`, `name`, `version 1`; offensive name → 400 with a friendly `message` (ACC-02 AC2); rename follows same rules (AC4); unknown code → 404; delete without `confirm` → 400; delete → 204 and subsequent `GET` → 404 (ACC-05 AC1).
- **Task 2.6 — Frontend `CreatePlanetComponent` and settings basics.** Create form (2–24 char counter), "I have a planet code" entry, on success stores id and switches to `planet`. `SettingsPanelComponent` skeleton: shows planet code with copy button, rename, "Leave this planet", "Delete my planet" (double confirm).
  **AC:** spec: submit posts name; 400 shows the server message and keeps the input (AC2); valid code resolves and stores id; leave clears storage and shows `create-planet`; delete requires two confirmations then calls `DELETE` and clears storage.

**Functional checks.** curl create → copy code → `by-code` → same id; delete → 404.

---

### Phase 3 — Planet state, mutation backbone and sync

**Objective.** The persistence/command backbone every gameplay feature plugs into.
**Requirements.** ACC-03, ACC-04 AC2, D-1..D-3.

- **Task 3.1 — Entities + migration `GardenSchema`.** `plants(id, planet_id FK cascade, type, lat, lon, stage enum seed|sprout|young|bloom, growth numeric, water numeric, planted_at, last_harvested_at null, harvest_ready bool)`, `decorations(id, planet_id, type, lat, lon)`, `inventory_items(id, planet_id, item_type, kind seed|decoration, count, unique(planet_id, item_type))`, `unlocks(planet_id, item_type, unlocked_at, PK)`.
  **AC:** up/down clean; indexes on `planet_id`; relations typed `Relation<T>`.
- **Task 3.2 — `PlanetSnapshotDto` + `PlanetStateService.getSnapshot(planetId)`.** Assembles planet, plants, decorations, inventory, unlocks, clouds, sun override, `serverTime`, `version`. The snapshot is a superset of `PlanetDto` (same top-level `id`, `code`, `name`, `version`, `createdAt`), so existing clients keep working. Later modules add data via a `SnapshotContributor` list, not by editing this method.
  **AC:** unit: contributors called in registration order and their output merged; e2e `GET /api/planet` returns the snapshot.
- **Task 3.3 — `PlanetStateService.mutate(planetId, expectedVersion, apply)` (D-2).** Transaction, `SELECT … FOR UPDATE`, version check → `ConflictException`, run `SimulationStep` list (empty until Phase 6), `apply(ctx)`, run `PostMutationEvaluator` list, pass facts to `FactSink` list, `version++` (only when a command was applied — see 3.4), return snapshot plus `events` and `newlyUnlocked`.
  **AC:** unit with in-memory fakes: mismatch throws 409 and `apply` never runs; success increments `version` by exactly 1; evaluators run after `apply`; an exception in `apply` rolls back (e2e: failing command leaves `version` unchanged).
- **Task 3.4 — `POST /api/planet/sync { expectedVersion }`.** Runs the `mutate` pipeline without a command: checks the version, advances the simulation and evaluators, but does **not** bump `version` (refined 1 Oct 2026: a heartbeat bumping the version would make two open tabs force each other to reload; only player commands count as changes for ACC-04 AC2). Updates `last_seen_at`, returns `{ snapshot, events }`.
  **AC:** e2e: matching version → 200 and `version` unchanged; stale → 409 `{ message: 'reload' }`; missing header → 400.
- **Task 3.5 — Frontend `PlanetStore` + `SyncService`.** Signals: `snapshot`, `version`, `pendingCommands`, `offline`, `reloadRequired`. Commands queue with `expectedVersion`, send serially, retry with backoff on network error (ACC-03 AC2), heartbeat every `syncIntervalSeconds`. `SaveIndicatorComponent` (icon + text, `aria-live="polite"`).
  **AC:** spec: command enqueued while HTTP fails → `pendingCommands() > 0` and indicator visible; later success drains the queue and hides it (AC3); 409 sets `reloadRequired` and a reload banner shows (ACC-04 AC2); heartbeat fires at the configured interval with fake timers.

**Functional checks.** Two curl clients with different `expectedVersion`; the second gets 409.

---

### Phase 4 — 3D planet view and navigation

**Objective.** A rotating, zoomable low-poly planet with mouse, keyboard and touch; loading screen with Pip.
**Requirements.** NAV-01, NAV-02, NFR-03 (loading), SET-05 (rotate/zoom).

- **Task 4.1 — `surfaceCoords.ts` (backend `simulation/`, frontend `core/helpers/`).** `toVector`, `fromVector`, `angularDistance`, `stepsBetween` (1 step = tunable arc). Shared fixture table `surface-coords.fixtures.json` in both specs.
  **AC:** round-trip error < 1e-6; antipodes = π; both specs pass the same fixture table.
- **Task 4.2 — `SceneService` + `PlanetMeshService`.** Renderer, scene, camera, RAF loop started in `afterNextRender`, `ResizeObserver`, `dispose()`. Planet = icosahedron with flat shading, radius from `radiusLevel`.
  **AC:** `PlanetViewComponent` spec with `NullSceneRenderer` renders without WebGL; `dispose()` called on destroy (spy); manual: planet visible at 4301.
- **Task 4.3 — `CameraControlsService`.** Drag rotates the planet group by incremental quaternions (no Euler, NAV-01 AC3), inertia with damping (AC1), arrows/WASD rotate (AC2); wheel/pinch/`+`/`-` zoom clamped between near (single plant fills a good part of the screen) and far (planet + clouds + sun visible) (NAV-02). `focusOn(lat, lon)` for later use. `reducedMotion` flag disables inertia and makes `focusOn` instant.
  **AC:** unit: 1000 random drags produce no NaN and never invert the up vector; zoom cannot exceed limits; key press rotates at a fixed rad/s; `reducedMotion` → no inertia.
- **Task 4.4 — `InputService` + `PickingService`.** Pointer (mouse/touch) and keyboard normalised to `drag`, `tap`, `pinch`, `key` streams; raycast → `{ kind: 'planet' | 'plant' | 'decoration' | 'creature' | 'cloud' | 'sun', id?, surface?: { lat, lon } }`.
  **AC:** unit with synthetic events: two-finger move → `pinch`; short down/up → `tap`; move beyond 4 px → `drag`; planet hit returns lat/lon that round-trips through `surfaceCoords`.
- **Task 4.5 — `LoadingComponent` with Pip + `PlanetPageComponent`.** Static CSS cloud; shown until snapshot and scene are ready. Page composes scene + HUD shell.
  **AC:** spec: loading visible while `GET /api/planet` pending, hidden after; manual: returning planet visible within 10 s on `ng serve` (timing logged).

**Functional checks.** Playwright screenshot of the planet; drag and wheel change the view.

---

### Phase 5 — Gardening core

**Objective.** Place and remove plants and decorations with server-validated rules, live preview, inventory.
**Requirements.** GRD-01, GRD-07 (remove), ITM-01, ITM-02, ITM-04 AC1.

- **Task 5.1 — `placementRules.ts` (both sides, shared fixtures).** `canPlaceAt(snapshot, point, footprint)` → `ok | occupied-plant | occupied-decoration | occupied-water | planet-full`; `isPlanetFull`.
  **AC:** unit: inside a pond footprint → `occupied-water`; within 1 step of a plant → `occupied-plant`; `maxPlants` plants → `planet-full`; clear spot → `ok`.
- **Task 5.2 — `InventoryService`.** `grant(planetId, items[])` → `{ items, newlyUnlocked }` (records first-time unlocks), `consume(planetId, type, n)` (400 if insufficient), `list()`. Count-0 rows deleted.
  **AC:** unit: consume more than owned throws; never-owned type appears in `newlyUnlocked` exactly once; zero rows removed (ITM-01 AC2).
- **Task 5.3 — `GardenService` commands + `GardenController`.** `plant`, `digUp`, `placeDecoration`, `moveDecoration`, `putAwayDecoration` via `mutate()`. Routes: `POST /api/garden/plants`, `DELETE /api/garden/plants/:id`, `POST /api/garden/decorations`, `PATCH /api/garden/decorations/:id/position`, `DELETE /api/garden/decorations/:id`. DTOs validate lat ∈ [−90, 90], lon ∈ [−180, 180], `expectedVersion`.
  **AC:** e2e: plant consumes one seed and adds a plant (GRD-01 AC1); occupied spot → 400 with the reason and inventory unchanged (AC3); plant number `maxPlants + 1` → 400 `planet-full` with a friendly message (AC4); dig up seed/sprout returns the seed, young/bloom does not (GRD-07 AC1); decoration place → move → put away restores inventory (ITM-02); lat 91 → 400.
- **Task 5.4 — Starter inventory on creation (ITM-04 AC1).** `PlanetsService.create` grants `starter.ts` and records unlocks.
  **AC:** e2e: new planet snapshot has seeds of ≥3 types, no decorations, those types unlocked.
- **Task 5.5 — Frontend placement.** `InventoryPanelComponent` (counts; types with 0 not shown), `PlacementService` (selected item signal, hover preview mesh + allowed/not-allowed icon from the client `placementRules`, click → command), `PlantMeshService`/`DecorationMeshService` (InstancedMesh per type, stage-based primitive shapes), context menu with "Dig up" / "Put away" / "Move". Receipt toast "flies to inventory" (ITM-01 AC3).
  **AC:** spec: preview state matches `canPlaceAt`; allowed click enqueues `plant`; a server 400 reverts the preview and shows the message; receipt toast appears once per grant; Enter on the keyboard surface cursor plants (SET-05 groundwork).

**Functional checks.** curl plant twice at the same coords → second 400.

---

### Phase 6 — Growth simulation and away catch-up

**Objective.** One deterministic rule set used live and for away time.
**Requirements.** GRD-04, GRD-05, GRD-06, TIM-01, TIM-02.

- **Task 6.1 — `sunModel.ts`.** `sunAngleAt(t, override?)` (drift period tunable; override holds 5 min then eases back), `lightAt(lat, lon, angle)` ∈ [0, 1], `averageLight()` = 0.5 (TIM-01 AC4).
  **AC:** unit: facing point = 1, antipode = 0; override returned within 5 min, drift after; average 0.5.
- **Task 6.2 — `growthRules.ts` (both sides, shared fixtures).** `waterStatus` → `thirsty | a-bit-thirsty | happy | soggy`; `lightStatus(pref, exposure)` → `too-sunny | too-dark | ok`; `growthMultiplier` (1, 0.5 one unmet, 0 thirsty); `advancePlant(plant, dt, light, cfg)` decays water, accumulates growth, stages at ⅓, ⅔, 1 of `bloomMinutes`, sets `harvestReady` on bloom; soggy dries out by itself; stage never regresses.
  **AC:** unit: needs met for `bloomMinutes` → bloom (GRD-05 AC1); one need unmet → 2× time (GRD-04 AC2); water 0 → stage frozen and `drooping` (AC3); soggy recovers (AC4); 30 simulated days never lower a stage (GRD-06); mushroom in full light → `too-sunny` (GRD-03 AC3 data).
- **Task 6.3 — `SimulationService.advance(ctx, now)`.** Steps in ≤15-min slices from `lastSimulatedAt` to `min(now, lastSimulatedAt + maxAwayDays)`; live mode uses the real sun angle, away mode (gap > 3 × sync interval) uses `averageLight`; sets `lastSimulatedAt = now` after capping (TIM-02 AC2); emits `plant-bloomed` / `plant-stage` facts. Registered as a `SimulationStep` in `mutate()`.
  **AC:** unit: 3 h gap with a 2 h sunflower → bloom (TIM-01 AC1); water out at hour 5 of 10 → exactly 5 h of growth (AC3); 30-day gap simulates 7 days and `lastSimulatedAt` = now; two 1 h advances equal one 2 h advance within 1e-9.
- **Task 6.4 — Frontend plant presentation.** `PlantPresenter` helper → `{ stage, droop, sparkle }`; optional interpolation of `growth` between syncs with the client `growthRules` (visual only, never ahead of the server stage).
  **AC:** spec: thirsty → droop; bloom + `harvestReady` → sparkle; interpolation never advances a stage.

**Functional checks.** e2e: plant, `X-Test-Now` +3 h, sync → stage `bloom`.

---

### Phase 7 — Clouds and sun

**Objective.** Drag clouds to rain and the sun to light, validated server-side, with keyboard access.
**Requirements.** GRD-02, GRD-03.

- **Task 7.1 — `cloudRules.ts`.** 3 clouds (tunable) in `planets.clouds` jsonb `{ id, lat, lon, water }`; `drift`, `drain`, `refill`; rain radius tunable.
  **AC:** unit: full cloud drains to 0 after `rainSeconds`; refills to 1 after 60 s; drift is continuous.
- **Task 7.2 — `GardenService.rain({ cloudId, lat, lon, seconds ≤ 2 })`, `moveCloud`, `moveSun(angle)`.** Rain raises `water` of plants within radius in proportion to seconds and cloud water, drains the cloud; `moveSun` sets override angle and time.
  **AC:** e2e: rain over a thirsty plant raises water (GRD-02 AC1); empty cloud changes nothing and returns `cloudEmpty: true` (AC2); `seconds 3` → 400; `moveSun` then `GET` shows the new angle (GRD-03 AC1); +5 min test clock → angle follows drift again (AC2).
- **Task 7.3 — Frontend `SkyService` + drag controllers.** Cloud and sun meshes orbit the planet, pale/shrunken when water is low; `CloudDragController` holds over the surface → one `rain` command per second with `seconds: 1`, rain particles; release continues drift from the release point (AC3); `SunDragController` throttled to ≤2 commands/s.
  **AC:** spec: hold 3.2 s → three `rain` commands; release stops; sun drag throttled; reduced motion disables particles.
- **Task 7.4 — Keyboard clouds and sun (GRD-02 AC4).** Tab cycles sky objects (ARIA listbox over the canvas), arrows move, Space toggles rain, Escape releases; focus highlight drawn in scene and announced in a live region.
  **AC:** spec: Tab focuses cloud 1; ArrowRight moves it; Space starts rain commands; Escape releases; live region text changes each step.

---

### Phase 8 — Harvest, info cards, catalogue UI, unlocks

**Objective.** The player can read state, harvest seeds, see what's unlocked.
**Requirements.** GRD-08, NAV-03, ITM-03 (UI), ITM-04 AC2/AC3, SET-04.

- **Task 8.1 — `GardenService.harvest(plantId)`.** Requires bloom + `harvestReady`; grants `seedsPerHarvest` (via `RandomService`); sets `lastHarvestedAt`, `harvestReady=false`; simulation re-arms after `harvestCooldownMinutes`.
  **AC:** e2e: harvest → inventory +1..2, plant still bloom (GRD-08 AC2); immediate second → 400 `cooldown` (AC3); +1 h test clock → `harvestReady` again (AC1).
- **Task 8.2 — `InfoCardComponent` + `statusText.ts`.** Hover/tap plant: type, stage, water and light status as icon + text with a suggestion ("a bit thirsty — hold a cloud over it"); decoration: name. Closes on move-away/tap elsewhere/Escape.
  **AC:** spec: thirsty card shows the icon and text; `role="dialog"`; Escape closes; a table test asserts every status has non-empty `icon` and `text` (SET-04).
- **Task 8.3 — `CatalogueComponent` + `humanDuration.ts`.** All plants/decorations/species; locked → silhouette + hint; unlocked → description, needs, "about N hours" from `bloomMinutes` (GRD-05 AC2); species → arrival hint (CRT-01 AC2) and the "cosy enough for now" note when the creature limit is reached (CRT-02 AC1).
  **AC:** spec: locked tulip renders silhouette + hint; unlocked clover shows "about 10 minutes"; species hint rendered; limit note appears when `creatures.length ≥ maxCreatures`.
- **Task 8.4 — `CelebrationService` (ITM-04 AC3).** Toast + sparkle on `newlyUnlocked` in any command response; fade only under reduced motion.
  **AC:** spec: `newlyUnlocked: ['tulip']` → "New in your catalogue: Tulip" once; reduced motion → no animation class.

---

### Phase 9 — Event log and welcome-back summary

**Objective.** Notable happenings are recorded; returning players see a factual summary.
**Requirements.** TIM-03; event log for JRN and CHT-02.

- **Task 9.1 — `Event` entity + migration `EventsSchema` + `EventLogService`.** `events(id, planet_id FK cascade, type, payload jsonb, occurred_at, is_milestone bool, index(planet_id, occurred_at))`. `append(planetId, facts[])`, `since(planetId, from)`. Registered as the `FactSink`.
  **AC:** e2e: a bloom during sync appears with `occurred_at` inside the away interval; first bloom has `is_milestone` true.
- **Task 9.2 — `eventSummary.ts`.** `summarise(events)` → ordered lines `[{ kind: 'blooms' | 'creatures' | 'gifts', count, focus: { lat, lon } }]`.
  **AC:** unit: 3 blooms + 1 arrival → two lines in that order; empty → `[]`.
- **Task 9.3 — `ReturnService.buildReturn(planet, now)` in sync.** `welcomeBack.summary` when `now − lastSeenAt ≥ summaryAfterMinutes` and events exist since (TIM-03 AC1/AC2). Journal added in Phase 14.
  **AC:** e2e: +3 h with a bloom → summary present; +10 min → absent; +3 h with no events → absent.
- **Task 9.4 — `WelcomeBackComponent`.** Lines; click → `CameraControlsService.focusOn` (TIM-03 AC3); dismiss.
  **AC:** spec: renders "3 plants bloomed · 1 new creature"; click emits focus with the payload coordinates; dismiss hides.

---

### Phase 10 — AI gateway, content rules, fallback infrastructure, AI switch

**Objective.** A single safe path to the model before any creature feature uses it.
**Requirements.** AIB-01, AIB-02, AIB-04, AIB-05 (infra), ADM-01, NFR-10.

- **Task 10.1 — `contentRules.ts`.** `checkText(text, { maxWords, maxSentences })` → violations (`banned-term`, `guilt-trip`, `url-or-email`, `too-long`, `not-english` heuristic); `wordCount`. Phrase lists in `content/blocked-words.ts` and `content/guilt-phrases.ts`.
  **AC:** unit: "I was so lonely without you" → `guilt-trip`; 70 words at max 60 → `too-long`; every §10.3 "Fine" example passes; every "Not fine" text example fails.
- **Task 10.2 — `AdminSettings` + `AiUsage` entities + migration `AdminSchema` + `AdminSettingsService`.** `admin_settings(key PK, value jsonb, updated_at)` for `aiEnabled`, `aiDailyBudget`; `ai_usage(id, feature, planet_id null, used_fallback bool, latency_ms, created_at)`. In-memory cache with 60 s TTL (ADM-01 AC1).
  **AC:** unit with `FakeClock`: two `get` calls within 60 s hit the DB once; `set` invalidates; defaults when the row is absent.
- **Task 10.3 — `AiGatewayService.generate<T>(req)` (D-4).** Order: kill switch → budget (today's non-fallback `ai_usage` count < `aiDailyBudget`) → `AiService.complete` raced with `aiTimeoutMs` → `req.parse` (tolerant of code fences) → `req.validate` + `checkText` → retry once → `req.fallback()`. Always logs usage; returns `{ value, source: 'ai' | 'fallback', reason? }`; never throws.
  **AC:** unit with a scripted fake adapter: switch off → fallback, adapter not called (AIB-05 AC1); budget reached → fallback; first invalid, second valid → second returned, adapter called twice (AIB-01 AC2); both invalid → fallback; hang > timeout → fallback (AIB-04 AC2); throw → fallback; one `ai_usage` row per call with correct `used_fallback`.
- **Task 10.4 — `promptContext.ts` privacy builders (AIB-02).** Builders accept only `PlanetPublicState`, `CreatureIdentity`, `CreatureMemory[]`, `Event[]` and the player's own chat lines with that creature. A spec serialises every builder's output over tempting fixtures.
  **AC:** spec: output contains no `@`, no `code` (planet code), no other planet's id.
- **Task 10.5 — Admin API + scripted fake.** `GET/PATCH /api/admin/settings` (open, per D-0). `FakeAiService` extended with a queue: `respondWith(json | 'hang' | 'throw')`.
  **AC:** e2e: PATCH `{ aiEnabled: false }` → a test route's gateway call uses fallback after the cache TTL (FakeClock); README notes the admin view is unprotected in the PoC.

---

### Phase 11 — Creatures

**Objective.** Creatures move in when conditions are met, with stable AI identities and a fallback pool.
**Requirements.** CRT-01, CRT-02, CRT-03, CRT-05, AIB-05 (identity).

- **Task 11.1 — `Creature` entity + migration `CreaturesSchema`.** `creatures(id, planet_id FK cascade, species, name, identity jsonb { traits[], quirk, speakingStyle, backstory, summary }, identity_source ai|fallback, mood content|cheerful|overjoyed, mood_since, wistful bool, arrived_at)`. `arrival_tracking` jsonb on planet: `{ [species]: { metSince }, lastArrivalAt, firstArrivalDone }`.
  **AC:** up/down clean.
- **Task 11.2 — `arrivalConditions.ts`.** Condition descriptors → predicates (`bloomingCount(type) ≥ n`, `hasDecoration(type)`, `distinctBloomingTypes ≥ n`, `firstBloom`); `evaluateArrivals(snapshot, tracking, now, cfg)` → `{ arrivals, tracking }` applying the 2-min delay, 30-min spacing, `maxCreatures`, `maxPerSpecies`.
  **AC:** unit: snail true with 3 blooming clovers + pond, false with 2; met 1 min → none, 2 min → arrives; two species met → one now, the other after 30 min; 8 creatures → none; a third snail never.
- **Task 11.3 — `IdentityService.create(species, publicState, existingNames)`.** Prompt for JSON `{ name, traits[2–3], quirk, speakingStyle, backstory ≤3 sentences, summary }`; validate shape, sentence count, name not in `existingNames` or `blocked-names.ts`, `checkText`; fallback pool `content/fallback-identities.ts` (≥10 per species, unused first).
  **AC:** unit: valid JSON accepted; 4-sentence backstory → retry then fallback; duplicate name → rejected (CRT-03 AC2); consecutive fallbacks on one planet differ; `identity_source` recorded and never regenerated (AIB-05 AC2).
- **Task 11.4 — `CreaturesService` as `PostMutationEvaluator` + `SnapshotContributor`.** Evaluates arrivals on every mutate/sync, creates creatures, appends `creature-arrived` milestone events, adds creatures to the snapshot. No deletion path except planet delete (CRT-05).
  **AC:** e2e: 3 clovers + pond, force bloom via test clock, +2 min sync → snail present with scripted identity and event logged (CRT-01 AC1); fake AI throws → fallback identity, 200, no error (CRT-03 AC4); +30 days → creatures unchanged (CRT-05 AC1).
- **Task 11.5 — Frontend creatures.** `CreatureMeshService` (primitive low-poly per species; wander between nearby surface points; sleep on the dark side), arrival drop-in (fade under reduced motion), `CreatureCardComponent` (name, species, summary, mood, want slot, expandable backstory — CRT-03 AC1).
  **AC:** spec: tapping a creature opens the card with name/species/summary/mood; backstory hidden until "More"; `wanderStep()` never leaves the sphere.

---

### Phase 12 — Wants, fulfilment, rewards, mood

**Objective.** Each creature has at most one achievable want; fulfilment is auto-detected and rewarded.
**Requirements.** WNT-01..05, CRT-04, ITM-04 AC2, GRD-07 AC3.

- **Task 12.1 — `Want` + `CreatureMemory` entities + migration `WantsSchema`.** `wants(id, creature_id FK cascade, type plant-near|count-blooming|place-decoration|variety|bring-back, params jsonb, text, plain_description, status active|fulfilled|dismissed, source ai|fallback, created_at, resolved_at)`; `creature_memories(id, creature_id FK cascade, kind chat|want|event, text, created_at)`.
  **AC:** up/down clean; partial unique index: one `active` want per creature (WNT-01 AC2).
- **Task 12.2 — `wantEvaluator.ts`.** `evaluate(want, snapshot)`, `isAchievable(want, snapshot, unlocks)` (items owned or unlocked, counts ≤ `maxPlants`, anchors exist), `describe(want)` (WNT-02 AC2), `dependsOn(want, plantId)`.
  **AC:** unit per type: fulfilled/unfulfilled fixtures; want for a locked plant → not achievable (WNT-02 AC1); `bring-back` achievable only when the item was previously placed; `describe` yields "2 moonflowers within 3 steps of the lamp-post".
- **Task 12.3 — `WantGenerationService`.** Gateway call with identity, memory, public state, allowed types; validate with `isAchievable` + `checkText(≤2 sentences)`; fallback pool `content/fallback-wants.ts` templated with real items; `tutorial` flag forces a want fulfillable with owned items (ONB-02 AC3); wistful creatures get `bring-back` (CRT-04 AC3).
  **AC:** unit: AI want for a locked plant → discarded, fallback used, never persisted (WNT-02 AC4); tutorial flag → achievable with current inventory; wistful → `bring-back` of the right item.
- **Task 12.4 — `WantsService` evaluator + commands.** On sync/mutate: creatures with no active want past cooldown get one (WNT-01 AC1); active wants evaluated → fulfilled: scripted thank-you line in the identity's style, mood +1 (capped), memory `want`, event `want-fulfilled`, reward. `POST /api/wants/:id/maybe-later` → `dismissed`, no mood change, cooldown restarts (WNT-05). Wants never expire.
  **AC:** e2e: fulfil by planting → next sync `fulfilled`, mood `cheerful`, reward in inventory and in response (WNT-03, WNT-04 AC1); maybe-later → `dismissed`, mood unchanged, new want after +1 h (WNT-05 AC1/AC2); a want untouched for 30 days stays `active` (AC3).
- **Task 12.5 — `RewardService` + overjoyed gift.** `rewardFor(planet)` picks items; every `unlockEveryNRewards`-th reward picks a locked catalogue item while any remain (WNT-04 AC2). Simulation step: overjoyed for `overjoyedGiftHours` → gift + mood back to `cheerful` + event (CRT-04 AC2). Arrival condition no longer met → `wistful` (AC3).
  **AC:** unit: 9 rewards with 3 locked items → ≥3 unlocks; nothing locked → owned types; overjoyed + 24 h → one gift event and `cheerful`; removing the pond → snail `wistful`.
- **Task 12.6 — Frontend wants.** Want in creature voice + plain description on the card, "Maybe later"; mood icon + text; fulfilment reaction (hop + sparkle, fade under reduced motion); reward reveal before the inventory toast (WNT-04 AC1); dig-up on a plant a want depends on shows "Mira will notice" first (GRD-07 AC3).
  **AC:** spec: both texts shown; maybe-later posts and the card updates; dig-up on a dependent plant shows the named confirmation before the command.

---

### Phase 13 — Chat with creatures and memory

**Objective.** In-character chat with memory, daily limit, wellbeing safeguard, delete chats.
**Requirements.** CHT-01..04, AIB-03, NFR-10.

- **Task 13.1 — `ChatMessage` entity + migration `ChatSchema`.** `chat_messages(id, creature_id FK cascade, role user|creature|notice, text, source ai|fallback|scripted, created_at, index(creature_id, id))`. Daily count = user messages across the planet's creatures since UTC midnight.
  **AC:** up/down clean; `EXPLAIN` on the daily count query uses an index.
- **Task 13.2 — `creaturePrompt.ts`.** `buildCreatureSystemPrompt(identity, species, memories, publicState, recentEvents)` embedding §10 rules (stay in character, steer back, ≤60 words, no personal info, "I live on a tiny planet in a game"), plus the last N turns.
  **AC:** unit: prompt contains name/traits/quirk/style and every memory highlight; passes the Task 10.4 privacy spec; snapshot test.
- **Task 13.3 — `wellbeing.ts`.** `detectDistress(text)` → `none | sad | danger` using `content/wellbeing-phrases.ts`; resource message with `SUPPORT_URL` from config.
  **AC:** unit: "I feel really down today" → `sad`; a self-harm phrase → `danger`; "the sunflower looks sad" → `none`.
- **Task 13.4 — `ChatService` + `ChatController`.** `POST /api/creatures/:id/chat { text ≤ chatMessageMaxChars }`: limit reached → scripted sleepy line, `limitReached: true`, no AI call (CHT-03 AC1); distress → `notice` + prompt directive "kind, no banter" (AIB-03 AC2); gateway call; fallback napping line on timeout/failure (CHT-01 AC4); store turns; `MemoryService.extractHighlight()` every 5 user turns → `creature_memories kind=chat` (CHT-02 AC4); every response carries `remaining` (CHT-03 AC2). `GET …/chat?before=` paged. `DELETE …/chat` removes messages and chat-kind memories only (CHT-04 AC2).
  **AC:** e2e: 30 messages → the 31st returns the sleepy line and `remaining: 0` with no AI call; fake `hang` → fallback within timeout, user message kept; distress → `notice` with link plus a creature reply; forget → chat rows and chat memories gone, want memories kept.
- **Task 13.5 — Frontend `ChatPanelComponent`.** Scripted greeting via `waitingLine`/`greeting(identity)` helpers (no AI call), `maxlength` from config, in-character waiting indicator (CHT-01 AC3), remaining indicator when ≤5, disabled input at limit, scroll-up history (CHT-04 AC1), "Forget our chats" confirm, notice rendering with link.
  **AC:** spec: send shows the waiting line until the reply; limit response disables input; `remaining 3` visible, `remaining 12` hidden; history loads on open; forget → confirm → DELETE and empty list.

---

### Phase 14 — Planet Journal

**Objective.** AI diary entries grounded in the event log, template fallback, a readable book.
**Requirements.** JRN-01, JRN-02, JRN-03, AIB-05 (journal).

- **Task 14.1 — `JournalEntry` entity + migration `JournalSchema`.** `journal_entries(id, planet_id FK cascade, text, source ai|template, covers_from, covers_to, created_at, index(planet_id, created_at desc))`.
  **AC:** up/down clean.
- **Task 14.2 — `journalFactCheck.ts`.** `verify(text, events, snapshot)` → violations: creature names not on the planet, counts above the event log, event words ("gift", "arrived", "bloomed") without such events, > `journalMaxWords`. `templateEntry(events, snapshot, date)` with date-seeded variety.
  **AC:** unit: a non-existent creature → violation (JRN-02 AC2); "a parcel arrived" with no gift event → violation (AC1); quiet weather entry with no events → ok (AC3); template with zero events is ≤150 words and names a real creature when one exists.
- **Task 14.3 — `JournalService.writeIfDue(planet, now)` in `ReturnService`.** When away ≥ `journalAfterHours` and no entry in the last 4 h (JRN-01 AC4): gather events since the previous entry (max 7 days), gateway generate with `verify` as validation → template fallback; `welcomeBack.journalEntry`. `GET /api/journal?before=` newest first; milestone events exposed for markers.
  **AC:** e2e: +5 h with a bloom → entry `source: 'ai'` with scripted text, dated; immediate re-sync → no second entry; scripted AI naming "Zorblax" → `source: 'template'`; AI off → template (JRN-02 AC4); +3 h → no entry.
- **Task 14.4 — Frontend `JournalPageComponent` + `JournalBookComponent`.** Diary page above the summary on return (JRN-01 AC1); book pages newest first with milestone markers; reopen a dismissed page (AC3, JRN-03).
  **AC:** spec: return payload shows entry text above summary lines; book lists newest first; milestone badge for `is_milestone`; dismiss then open book shows the same entry.

---

### Phase 15 — Onboarding with Pip

**Objective.** A scripted first session that reaches first bloom and first creature within the session.
**Requirements.** ONB-01, ONB-02.

- **Task 15.1 — `content/tutorial.ts`.** Steps: welcome, rotate, open inventory, plant the starter seed, water with a cloud, move the sun, inspect a plant, goodbye. Each: text, `completesWhen` predicate over snapshot/action stream, element to highlight.
  **AC:** content spec: every step has text ≤2 sentences passing `checkText`, a predicate and a highlight target.
- **Task 15.2 — `PATCH /api/planet/tutorial { step }`.** Persists `tutorial_step` monotonic; `-1` = finished (ONB-01 AC4). `GET /api/planet` includes it.
  **AC:** e2e: step 3 saved; step 2 after 3 → 400; `-1` accepted.
- **Task 15.3 — Frontend `TutorialService` + `PipComponent`.** Advances only when the predicate holds (ONB-01 AC2), persists, resumes on reload (AC4), goodbye turns Pip into a help button (AC3); steps announced in a live region.
  **AC:** spec: a `plant` action during the "rotate" step does not advance; satisfying the predicate advances and PATCHes; boot with `tutorialStep 4` shows step 4; after the last step Pip becomes a help button.
- **Task 15.4 — First-session pacing (ONB-02).** Worm condition `firstBloom`; `arrivalDelaySeconds` 0 for the first arrival (`firstArrivalDone` flag); starter clover ≤10 min; first want generated with the `tutorial` flag.
  **AC:** e2e with test clock: new planet → plant clover → rain → sun → bloom at ≤10 min (AC1); next sync → worm with identity (AC2); its want `isAchievable` with current inventory (AC3). Manual: sign-up to first creature ≤12 min wall clock, logged.

---

### Phase 16 — Settings and accessibility

**Objective.** Persisted audio settings, reduced motion, keyboard-complete play, WCAG AA on the 2D UI.
**Requirements.** SET-01, SET-03, SET-04 (audit), SET-05 (audit), NFR-04, NFR-05.

- **Task 16.1 — `settings` jsonb on `planets` + `GET/PATCH /api/planet/settings`.** `musicVolume`, `musicMuted`, `sfxVolume`, `sfxMuted`, `reducedMotion auto|on|off`.
  **AC:** e2e: PATCH persists and GET returns it after a fresh load (SET-01 AC2); out-of-range volume → 400.
- **Task 16.2 — `AudioService`.** Web Audio; a few procedural or free-licensed loops and blips under `public/audio/`; per-channel volume and mute applied immediately (SET-01 AC1).
  **AC:** spec with a fake `AudioContext`: volume 0.3 → gain 0.3; mute → gain 0 and prior volume restored on unmute.
- **Task 16.3 — `MotionPreferenceService`.** Combines `prefers-reduced-motion` and the setting; all scene animators and `CelebrationService` consult it (SET-03).
  **AC:** spec: media query true → `reduced()` true unless setting `off`; animators return amplitude 0 when reduced.
- **Task 16.4 — Colour-independence audit (SET-04).** Every status (needs, mood, placement) has icon + text; enforced by a spec iterating the `statusText` tables.
  **AC:** spec: each entry has non-empty `icon` and `text`; Playwright screenshot shows icons beside colours.
- **Task 16.5 — Keyboard-only play (SET-05).** Focus ring styles; `KeyboardSurfaceCursor` (arrows move a cursor on the sphere, Enter plants/selects); roving tabindex over scene objects with name announcements; `?` opens shortcut help; all menus Tab-reachable.
  **AC:** spec: Tab order is scene listbox → HUD; Enter on a focused creature opens its card; manual checklist of every SET-05 AC1 verb done without a mouse, recorded in `docs/plans/2026-10-01-pocket-planet-gardener-poc-verification.md`.
- **Task 16.6 — WCAG AA scan (NFR-05).** axe run (via the Playwright MCP) over create-planet, HUD, info card, creature card, chat, journal, settings; fix contrast tokens in `styles.scss`; canvas has `aria-label`; info card duplicates all 3D info as text.
  **AC:** zero AA violations reported; results recorded in the verification file.

---

### Phase 17 — Hardening and NFR verification

**Objective.** Evidence for the Must NFRs before calling the PoC done.
**Requirements.** NFR-01, NFR-02, NFR-03, NFR-06, NFR-07, NFR-11.

- **Task 17.1 — Performance (NFR-02).** Dev-only seed script for a full planet (`maxPlants` plants, `maxCreatures` creatures, 3 clouds); InstancedMesh for plants, merged geometry for decorations, capped pixel ratio.
  **AC:** ≥30 fps logged in Chrome and Firefox on the dev laptop with the full fixture; no per-frame allocations in the render loop (profiler check noted).
- **Task 17.2 — Start time (NFR-03).** Lazy-load journal, catalogue, settings and admin chunks; measure time-to-planet for a returning player.
  **AC:** ≤10 s on a DevTools "Fast 3G" profile, logged.
- **Task 17.3 — Browser smoke (NFR-01).** Must-AC smoke list in Chrome, Edge, Firefox, Safari (or WebKit via Playwright).
  **AC:** checklist with results in the verification file.
- **Task 17.4 — Delete planet completeness (ACC-05, NFR-06).** e2e populates every table for a planet, deletes it, walks FK metadata and asserts no orphan rows.
  **AC:** FK-walk e2e passes with every table populated.
- **Task 17.5 — Tone review (NFR-11).** Content spec runs `checkText` over all scripted text in `content/`; a dev harness samples 50 gateway outputs per feature against the real model and runs `checkText`.
  **AC:** zero violations in scripted text; sample report attached to the verification file.
- **Task 17.6 — Docs.** README layout and endpoint table, `.env.example`, CLAUDE.md gotchas learnt (test clock header, `X-Planet-Id`, PoC has no auth).
  **AC:** README endpoint table matches the route list printed at boot; `.env.example` keys equal the set read via `config.get` (grep audit).

---

## 7. Sequencing, dependencies, risks

**Order.** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15 → 16 → 17. Phase 4 (3D view) depends only on Phase 1 and can run in parallel with 2–3 on the frontend side. Phase 15 (tutorial) comes after creatures and wants because ONB-02 needs them.

**External dependencies.** `three`, `@types/three`; the LiteLLM endpoint already in `.env`; Postgres `epikrise-demo` on 5443. Optional: `@axe-core/playwright`.

**Risks and mitigations.**

| Risk | Mitigation |
|---|---|
| three.js in jsdom tests (no WebGL) | `SCENE_RENDERER` token + `NullSceneRenderer`; pure math helpers tested separately. |
| Frontend bundle budget | Raised via `ng config` (Phase 1); lazy-load non-core UI (Phase 17). |
| ESM Jest quirks (`jest` import, no `jest.mock`) | Every service takes collaborators via constructor; `FakeClock`, `SeededRandom`, scripted `FakeAiService` injected. |
| e2e specs share the dev DB | Each spec truncates only its tables with `RESTART IDENTITY CASCADE`; `maxWorkers: 1`; table list in `test/support/db.ts`. |
| Time-dependent logic | `ClockService` everywhere; `X-Test-Now` only under `NODE_ENV=test`. |
| LLM returns non-JSON or invalid content | Gateway: tolerant parse, validate, one retry, fallback; scripted fake covers every branch. |
| Duplicated pure helpers front/back | Shared fixture tables; drift fails a test. |
| Private data in prompts | Type-restricted builders + serialisation spec (Task 10.4). |
| Content volume (60 fallback identities, want templates, Pip script) | Content specs enforce shape so placeholders are caught; PO owns the voice (Q-7). |
| AI cost | Request-count budget at the gateway; greetings, thank-yous and waiting lines are scripted, not AI. |
| TypeORM `^1.1.1` migration generation for jsonb/partial indexes | Verify in Phase 2; fall back to hand-written SQL migrations (the existing one is raw SQL). |
| No auth (D-0) | Explicitly a PoC. Anyone with a planet code can open that planet. Must be replaced before any wider use. |

## 8. Critical files

- `backend/src/ai/ai.service.ts` — the only AI adapter; `AiGatewayService` wraps it.
- `backend/src/app.module.ts` — module registration root.
- `backend/src/database/data-source.ts` — `MIGRATIONS` list and entity registration.
- `backend/test/support/app.ts`, `backend/test/support/fake-ai.ts` — e2e boot and fake AI every phase builds on.
- `frontend/src/app/app.ts` — root component that becomes the view switch.
- `CLAUDE.md` — binding conventions.

---

## 9. Progress log

### Phases 1–2 — done (1 Oct 2026)

All tasks 1.1–1.6 and 2.1–2.6 implemented. Gates: backend `tsc --noEmit` 0, `npm run lint` 0 (no rewrites), unit 208/208, e2e 36/36; frontend build 0 (167 kB initial), tests 92/92; migrations `DropMessages` and `PlanetSchema` revert and re-apply cleanly, no schema drift; live curl of every planet route including failure paths; browser run create → reload → settings → two-step delete against the real backend. **Not run:** backend `npm run build` (it deletes `dist/` under the running watch server; `tsc --noEmit` covers compilation).

Deviations from the task text:
- Task 1.4 ran after 2.3 (the guard needs the `planets` table) and lives in `backend/src/planets/planet-context/`, not `common/`, because it depends on the Planet repository.
- Helper files use kebab-case (`name-rules.ts`, `planet-code.ts`) to match the codebase.
- `seedsPerHarvest` is two tunables, `seedsPerHarvestMin` / `seedsPerHarvestMax`.
- Name rules let letters repeat but never collapse ("ass" is not shrunk to "as"); words run together are not caught.
- `X-Test-Now` must be a full ISO timestamp with `Z` or an offset.
- Frontend: a 400 on startup (malformed stored id) clears the id like a 404; create and rename share `ui/planet-name-form`.

Carried into later phases:
- Rename does not bump `version` (a unit test asserts it); Phase 3's `mutate()` takes over versioning.
- `PlanetsService` is not exported from `PlanetsModule`; export it when another module needs it.
- Decorations have no water flag: Task 5.1 treats the pond as water by id, or adds a flag.
- `STARTER_INVENTORY` has exactly 3 types; Task 5.4 decides how `starterSeedTypes` maps onto it.
- `BLOCKED_NAMES` holds multi-word names; Task 11.3 can pass it to `validateName`, which matches phrases across separators. Task 17.5's tone check must skip it.
- three.js is not yet imported by app code, so the raised bundle budget is first exercised in Phase 4.
- `AiModule` is not imported by `AppModule` until the gateway (Phase 10).

### Phase 3 — done (1 Oct 2026)

All tasks 3.1–3.5 implemented. Gates: backend `npm run lint` 0 (no rewrites), `tsc --noEmit` 0, unit 236/236, e2e 58/58; frontend build 0 (175 kB initial), tests 129/129; `GardenSchema` reverts and re-applies cleanly, no schema drift; live two-client check (A syncs v1 → 200, version bumped elsewhere, B syncs v1 → 409 `reload`, A syncs v2 → 200); browser run against the real backend: heartbeat every ~10 s with 200 and `version` unchanged while `last_seen_at` advances, offline indicator appears when sync is unreachable and clears on recovery, a version bump elsewhere shows the reload banner and stops the heartbeat, Reload recovers on the new version. **Not run:** backend `npm run build` (same reason as Phases 1–2).

Deviations and refinements:
- A sync checks the version but never bumps it, and the version check runs before the simulation steps (Tasks 3.3/3.4 text updated).
- `GET`, `POST` and `PATCH /api/planet` return the snapshot, a superset of `PlanetDto`.
- `stage`/`kind` are varchar + TS unions, coordinates and levels `double precision`; `decorations` gained `placed_at`.
- `PlanetStateService.sync()` is the only place that sets `lastSeenAt`; hooks still see the previous value (Phase 9 relies on that).
- Frontend: `PlanetService.planet` replaced by `PlanetStore.snapshot`; commands and heartbeat share one request lane; 0/502/503/504 count as offline with 1 s → 30 s backoff.

Carried into later phases:
- The sync response has no `newlyUnlocked`; Phase 12 decides whether an unlock during a sync must be announced.
- Rename still bypasses `mutate()`/`SyncService` and does not bump the version.
- Sync events are discarded by the frontend until Phase 9 consumes them.
- e2e probe controllers reach `PlanetStateService` through `ModuleRef` (AppModule does not re-export PlanetsModule).

### Phase 4 — done (2 Oct 2026)

All tasks 4.1–4.5 implemented. Gates: backend lint 0 (no rewrites), `tsc` 0, unit 293/293, e2e 58/58; frontend `tsc` 0, tests 247/247, build 0 (737 kB initial including three.js, under the 1.5 MB warning). Live Playwright: low-poly planet renders with WebGL; drag, wheel and arrow keys each change the view; Pip's loading screen goes once the planet is ready. **Not run:** backend `npm run build`.

Notes:
- `surface-coords.ts` and its fixtures are byte-identical in `backend/src/simulation/` and `frontend/src/app/core/helpers/`; a backend spec fails on drift — edit both together. Convention: degrees, y up, lon 0 faces +z, `STEP_ARC` = 5°.
- Rendering is on demand (dirty flag); later animated features must call `requestRender()` or keep the scene dirty while animating.
- Pickable objects register with `PickingService.register(object3d, { kind, id })`; meshes for plants, decorations, creatures, clouds and sun must do so.
- `CameraControlsService` reads `prefers-reduced-motion` once; Phase 16 replaces that with `MotionPreferenceService`.
- The session restarted mid-phase; both dev servers were restarted by the orchestrator (backend `start:dev`, frontend `npm start`).

### Phase 5 — done (2 Oct 2026)

All tasks 5.1–5.5 implemented. Gates: backend lint 0 (no rewrites), `tsc` 0, unit 328/328, e2e 86/86; frontend `tsc` 0, tests 335/335, build 0 (775 kB). Live: curl same spot twice → 400 `occupied-plant` with version and inventory unchanged; browser — planted three seed types (mounds rendered, inventory decremented), occupied spot refused with the friendly message, tap → "Dig up" → "+1 Clover seed" toast and count restored. **Not run:** backend `npm run build`.

Notes:
- `placement-rules.ts` is byte-identical front/back like `surface-coords`; `footprintSteps` is a diameter. Water is the content flag `DecorationType.isWater` (pond), exposed in the catalogue.
- Garden commands emit no events yet (Phase 9 adds them). Refusals are 400 `{ message, reason }`; each leaves one expected 400 line in the browser console.
- `PlanetsModule` imports `InventoryModule`; `InventoryModule` must never import `PlanetsModule`. `InventoryService.grant` returns `newlyUnlocked` — push it into `ctx.newlyUnlocked`.
- Frontend receipts diff inventory between snapshots, so later harvests/gifts toast automatically. `PickingService.registerInstances` supports instanced meshes. A small `core/helpers/reduced-motion.ts` reads the media query (Phase 16 replaces it).

### Phase 6 — done (2 Oct 2026)

All tasks 6.1–6.4 implemented. Gates: backend lint 0 (no rewrites), `tsc` 0, unit 429/429, e2e 90/90; frontend `tsc` 0, tests 419/419, build 0 (777 kB). Live (verification backend 3102 from source, frontend 4302): a planet aged 3 h turns a 2 h sunflower into a bloom with seeds ready, water 0.5 → 0.32, version unchanged, stage events at +40/+80/+120 min; browser shows sparkles on the ready bloom and a wilted thirsty clover. **Not run:** backend `npm run build`.

Decisions and notes:
- TIM-01 AC4 vs AC1: during away time light counts as met for every preference (average light "partly meets" without penalty), so a sunflower whose water holds blooms on time.
- Values: water decay per hour low 0.03 / medium 0.06 / high 0.09; thirsty < 0.12 ≤ a-bit-thirsty < 0.3 ≤ happy ≤ 0.85 < soggy; light ok: full-sun ≥ 0.5, partial 0.1–0.8, shade ≤ 0.3. Each unmet need × `unmetNeedGrowthFactor`; thirsty stops growth.
- Simulation slices are aligned to a 15-min global grid (light read at the cell midpoint) so results don't depend on sync frequency; growth is integrated exactly across water-threshold crossings. Facts: `plant-stage` (sprout, young), `plant-bloomed` (bloom).
- New tunable `sunDayMinutes` (60). Sun angle grows with time from 0 at the epoch; snapshot `sun.angle` (added by a SimulationModule contributor). Phase 7 must use the same convention.
- Optional growth interpolation not built (no in-stage visual to drive). Sparkles keep the scene redrawing while visible.
- Live servers: port 3101 is held by an orphaned `node dist/main` from an earlier orchestrator `start:dev`; stopping it was blocked by the permission classifier, and the `dist/` it reads went stale. Live verification now runs on 3102 (backend from source, `node --watch -r ts-node/register`) and 4302 (`ng serve` proxying to 3102).

### Phase 7 — done (2 Oct 2026)

All tasks 7.1–7.4 implemented. Gates: backend lint 0 (no rewrites), `tsc` 0, unit 480/480, e2e 109/109; frontend `tsc` 0, tests 495/495, build 0 (798 kB). Live (3102/4302): three clouds and the sun render; holding a cloud over a plant sends a rain command per second and raises its water; an empty cloud rests; dragging the sun turns the lit half; keyboard sky list (Tab, arrows, Space, Escape) works with announcements. **Not run:** backend `npm run build`.

Notes:
- `cloud-rules.ts` and `sun-model.ts` are byte-identical front/back (shared helpers now: surface-coords, placement-rules, growth-rules, cloud-rules, sun-model).
- Clouds are stored as anchors `{ id, lat, lon, water, at }`, re-anchored by a simulation step on every mutate/sync; a planet's clouds are `[]` until its first sync/command; clients extrapolate with `cloudAt(cloud, now)`.
- `MIN_RAIN_WATER` = 0.2: below it a cloud counts as empty and does not rain (GRD-02 AC2 "stops raining" despite continuous refill; ~12 s rest from empty).
- Sky commands answer 200. Each rain command bumps the version, so a second open tab shows the reload banner (ACC-04 AC2 as intended).
- A translucent wet patch marks a raining cloud (streaks are invisible from above). A cloud or the sun in front of the planet blocks taps behind it.

### Phase 8 — done (2 Oct 2026)

All tasks 8.1–8.4 implemented. Gates: backend lint 0 (no rewrites), `tsc` 0, unit 484/484, e2e 119/119; frontend `tsc` 0, tests 557/557, build 0 (815 kB). Live (3102/4302): harvest gives 1–2 seeds and a second harvest is refused with `cooldown`; the hover card shows stage, water and light as icon + text with suggestions; tapping a ready bloom harvests it with a receipt toast; Enter → "Collect seeds" works by keyboard; the catalogue shows unlocked items with needs and bloom time and locked ones as silhouettes with hints; a first-time unlock shows "New in your catalogue: X". **Not run:** backend `npm run build`.

Notes:
- `POST /api/garden/plants/:id/harvest` refuses with `not-ready` or `cooldown`; `SimulationService` re-arms seeds after `harvestCooldownMinutes`. The snapshot carries no `lastHarvestedAt` (no client countdown).
- The info card replaced the Phase 5 context menu (`PlacementService` card API). Settings and Catalogue share one panel slot.
- `CelebrationService` handles `newlyUnlocked`; sync responses still carry none (Phase 12).
- The e2e Jest `testTimeout` is 30 s (`test/jest-e2e.json`): a 5 s hook timed out under CPU contention from a parallel frontend build.

### Phase 9 — done (2 Oct 2026)

All tasks 9.1–9.4 implemented. Gates: backend lint 0 (no rewrites), `tsc` 0, unit 505/505, e2e 126/126; frontend `tsc` 0, tests 568/568, build 0 (817 kB); `EventsSchema` reverts and re-applies cleanly. Live: an aged planet's first sync returns `welcomeBack` with "1 plant bloomed"; the panel opens on reload and clicking the line turns the camera to the bloom. **Not run:** backend `npm run build`.

Notes:
- Every fact is persisted by `EventLogService` (a FactSink) in `events`; the planet's first bloom and any fact with `payload.milestone` are milestones. The entity class is `PlanetEvent`.
- `PlanetStateService.registerSyncContributor` runs on sync only, after the fact sinks and before `lastSeenAt` moves; `ReturnService` builds `welcomeBack: { summary }`.
- Event types later phases must emit: `creature-arrived` (with lat/lon and `milestone: true`), `want-fulfilled`, `gift-received`.
- Phase 14: export `EventLogService`, add `journalEntry` to `welcomeBack`, and allow `welcomeBack` with an empty summary for a quiet journal entry.
- The frontend syncs once right after the snapshot loads (`SyncService.syncNow()`), so the summary appears at once.
- Live checks and e2e must not run at the same time: e2e empties the dev database.

### Phase 10 — done (2 Oct 2026)

All tasks 10.1–10.5 implemented. Gates: backend lint 0 (no rewrites), `tsc` 0, unit 604/604, e2e 143/143; `AdminSchema` reverts and re-applies cleanly; frontend `tsc` 0, tests 582/582, build 0 (823 kB). Live: `GET/PATCH /api/admin/settings` (off → on, invalid budget → 400) and the admin page at `?admin=1` by keyboard. **Not run:** backend `npm run build`.

Notes:
- `AiGatewayService.generate()` is the only route to the model (AiModule exports nothing else): switch → daily budget → call raced against `aiTimeoutMs` (one window for both tries) → parse/`extractJson` → `validate` + `checkText` → one retry naming the problem → fallback. One `ai_usage` row per call; never throws.
- `checkText` covers banned terms, sensitive topics, guilt-tripping, URLs/emails, personal-info requests, claims to be real, famous names (everyday words like "goofy" skipped in free text) and length. The plan's `not-english` heuristic was not built.
- Prompt builders may only take `prompt-context.ts` types (`PlanetPublicState`, `PublicEvent`); `findPrivateData` backs the privacy specs.
- `mutate()` now locks the planet with `FOR NO KEY UPDATE` so a gateway call inside a command doesn't hang on the `ai_usage` foreign-key check.
- AI daily budget default 1000 requests (SD Q-8 undecided). Admin settings are cached 60 s; the admin API and page are open in the PoC (D-0). A minimal admin page was added beyond the plan's API-only task so the switch can be used.

### Phase 11 — done (2 Oct 2026)

All tasks 11.1–11.5 implemented. Gates: backend lint 0 (no rewrites), `tsc` 0, unit 691/691, e2e 151/151; `CreaturesSchema` reverts and re-applies cleanly; frontend `tsc` 0, tests 622/622, build 0 (844 kB). Live with the real model: a first bloom brought "Wiggleworth" the worm ("Believes that soil is actually a very soft, brown cake.", `identitySource: 'ai'`, 3.4 s) during a heartbeat, with the arrival toast and a nap on the night side in the browser. **Not run:** backend `npm run build`.

Decisions and notes:
- A first-bloom species (the worm, the tutorial creature) gets at most one creature per planet; other species are capped by `maxPerSpecies`.
- Arrivals happen inside `mutate()`, so the identity AI call runs while the planet row is locked (other commands for that planet wait, ≤ 15 s) — an accepted PoC limitation.
- Content-rules defect fixed: the disguised-spelling matcher turned "good" into "god"; now only banned words use it, and sensitive terms, phrases and famous names match exactly (plural allowed, multi-word names also run together).
- The creature card shows name, species, summary, quirk and mood; traits and the backstory are under "More".
- `ctx.previousSimulatedAt` is available to hooks. `CreaturesModule` exports nothing yet. Phase 15's no-delay first arrival is not built yet.

### Phase 12 — done (2 Oct 2026)

All tasks 12.1–12.6 implemented. Gates: backend lint 0 (no rewrites), `tsc` 0, unit 876/876, e2e 169/169; `WantsSchema` reverts and re-applies cleanly; frontend `tsc` 0, tests 721/721, build 0 (853 kB). Live with the real model: worm "Wigglenut" (quirk: "Believes that every pebble is actually a sleeping mountain.") wished "Ooh, such wiggly sunshine! Could we have two tall sunflowers blooming to wake up the sleeping mountains?" ("2 sunflowers in bloom"); when it came true during a heartbeat the page showed the hop, the reveal "Wigglenut gives you: 3 × Mushroom seeds" with the thank-you, then "+3 Mushroom seeds"; the creature turned cheerful and gained a memory. **Not run:** backend `npm run build`.

Notes:
- `want-evaluator.ts` is byte-identical front/back (shared helpers: surface-coords, placement-rules, growth-rules, cloud-rules, sun-model, want-evaluator).
- At most one want is generated per mutation, and none in the sync that brings a creature (it gets one at the next sync). `plant-near` and `variety` count any growth stage; `count-blooming` only blooms.
- The planet's first want is tutorial-fulfillable with owned items; wistful creatures ask for the missing condition item back (decoration first).
- Rewards: every `unlockEveryNRewards`-th want reward unlocks something new; overjoyed gifts don't advance the counter and only hold unlocked items. Sync responses carry `newlyUnlocked`.
- Minor gap: the inventory panel count updates before the reward reveal is dismissed (the receipt toast waits).
- The dig-up warning names the creatures whose wishes need the plant; plant Move (GRD-07 AC2, Should) does not exist, so no warning there.

### Phase 13 — done (2 Oct 2026)

All tasks 13.1–13.5 implemented. Gates: backend lint 0 (no rewrites), `tsc` 0, unit 919/919, e2e 199/199; `CreatureChatSchema` reverts and re-applies cleanly; frontend `tsc` 0, tests 752/752, build 0 (870 kB). Live with the real model: greeting, in-character answers in ~1.5–2 s, the homework question steered back to the planet ("numbers are far too pointy for me… Why don't we talk about our lovely, blooming clover instead?"), a memory highlight ("The gardener loves the colour yellow and wants to plant sunflowers."), the danger notice with a helpline link, and Forget clearing history and chat memories without restoring the daily limit. **Not run:** backend `npm run build`.

Decisions and notes:
- Chat runs outside `mutate()` (no version, no row lock during AI calls). Migration is `CreatureChatSchema`.
- Two defects found in live checks and fixed: answers were rejected for having more than 5 sentences (the cap was removed; up to 75 words are accepted while the prompt asks for 60, since the SD says "about 60"); "Forget our chats" reset the daily limit (the count now comes from `ai_usage`, `feature = 'chat'`, per planet since UTC midnight).
- The model rejects non-alternating turns, so the prompt builder merges same-role runs and ends on the player's message. Notices are not chat turns.
- `SUPPORT_URL` (default https://findahelpline.com) feeds the danger notice. Wellbeing phrase lists are short and non-graphic.
- Every 5th message waits for the memory highlight call (slower POST).

### Phase 14 — done (2 Oct 2026)

All tasks 14.1–14.4 implemented. Gates: backend lint 0 (no rewrites), `tsc` 0, unit 959/959, e2e 212/212; `JournalSchema` reverts and re-applies cleanly; frontend `tsc` 0, tests 784/784, build 0 (879 kB). Live with the real model: after 5 hours away the journal page opened above the welcome-back summary with a dated, warm entry that named the worm and only real events ("A clover has bloomed… Wigglesworth the worm has moved in, and he is absolutely delighted…"), with milestone badges; entries passed the fact check on the first try (74–82 words); the journal book pages newest first. **Not run:** backend `npm run build`.

Notes:
- Every entry is fact-checked against the event log (`verify`): unknown creature names, invented gifts/arrivals/blooms/wishes, inflated counts and length → retry → template from the event log. The name check is heuristic (pool names and "X the <species>").
- `welcomeBack` is sent when the summary is non-empty OR a journal entry was written; a quiet day still gets a cosy entry.
- The journal AI call runs inside the sync transaction (like creature identities).
- `toPublicEvents` now names the creature behind a fulfilled wish or a gift, so prompts can mention them.
- The diary page date uses the player's local time zone; the AI prompt's date heading is UTC.

---

## Appendix A — Not planned (Should / Could)

Listed so nothing is lost; none of these are in the PoC.

| ID | Requirement | Priority |
|---|---|---|
| ONB-03 | Skip the tutorial | Should |
| NAV-04 | Living planet idle animation (sway, drift, wander beyond the minimum built in Phases 7 and 11) | Should |
| GRD-07 (move) | Move a plant | Should |
| GRD-09 | Planet grows with the garden | Should |
| CRT-06 | Rename a creature | Should |
| CRT-07 | Say goodbye to a creature | Could |
| CHT-05 | Creatures talk to each other | Could |
| SOC-01..07 | Visibility, visit links, visit mode, gifts, stamps, vacation, galaxy | Should/Could |
| SOC-08 | Report a planet (Must only once SOC-03 exists) | — |
| AIB-06 | Flag AI content | Should |
| AIB-07 | Consistency with identity and species (beyond what the prompt and `checkText` give) | Should |
| SET-02 | Text size | Should |
| SET-06 | Touch (basic drag/pinch/tap exist via `InputService`; long-press and tap-to-place polish are not planned) | Should |
| SET-07 | Switch off chat | Could |
| ADM-02 | Limits UI (the budget value exists in `admin_settings`; no UI beyond the AI switch) | Should |
| ADM-03 | Moderation | Should |
| ADM-04 | Usage overview | Could |
| NFR-09 | Capacity (1,000 players / 100 concurrent) | Should |
| NFR-12 | AI response time targets | Should |

## Appendix B — Open questions carried from the SD

| ID | Question | Assumption in this plan |
|---|---|---|
| Q-1 | Hosting | Own servers (the scaffold). |
| Q-2 | Under-13 players | 13+; no parental controls. |
| Q-3 | Touch required | No; desktop first. |
| Q-4 | Social in first release | No (Appendix A). |
| Q-5 | Guest mode | Moot: there are no accounts (D-0). |
| Q-6 | Who makes 3D assets, music, sounds | Procedural meshes in code (D-8); procedural or free-licensed audio. |
| Q-7 | Content and voice sign-off | Product owner; content specs enforce shape only. |
| Q-8 | Daily AI budget | `aiDailyBudget` in `admin_settings`, default to be set by the owner. |
