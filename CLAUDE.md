# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## 5. Never Hand-Edit Generated Manifests

**The CLI owns the file. You own the argument.**

Never edit `package.json`, `package-lock.json`, or `angular.json` with an editor, `sed`, or a script. Use the tooling:

| Intent | Command |
|---|---|
| Add a dependency | `npm install <pkg>` |
| Remove a dependency | `npm uninstall <pkg>` |
| Change a script or field | `npm pkg set scripts.x="..."` |
| Change Angular config | `ng config <path> <value>` |
| Scaffold code | `nest generate ...` / `ng generate ...` |

**Do not specify versions.** Write `npm install @nestjs/config`, never `npm install @nestjs/config@^4.0.4`. Let the resolver pick. A sub-package's major version does not track its framework's major version — `@nestjs/config@12` and `@nestjs/typeorm@12` are correct on NestJS 11. Check `peerDependencies` before concluding a version is wrong.

To undo a dependency change, `npm uninstall` it — do not edit the manifest back by hand.

## 6. Never Expose Secrets

- `.env` is gitignored and may hold live credentials. Never print, echo, or paste a secret value — read it programmatically (`grep`/script) and pass it on without displaying it.
- Mask secret values in any output you show: `sed -E 's/(PASSWORD|SECRET|KEY|TOKEN)=.*/\1=***/I'`.
- Never commit `.env`. Keep `.env.example` in sync with the variables the code actually reads, with empty values.
- Never log an API key, a URL with credentials embedded, or a provider's raw error body to the client.

## 7. Respect the Machine's Existing State

- Ports and containers may already be in use by unrelated projects. Check before binding (`docker ps`, probe the port); pick a free one rather than taking a bound one.
- Never stop, restart, or delete a container, process, or database you did not create.
- npm installs here go through a TLS-intercepting corporate proxy. Prefix installs with `NODE_OPTIONS=--use-system-ca` or each request retries ~70s and an install takes ~15 minutes instead of ~30 seconds. Never "fix" this by disabling `strict-ssl` or setting `NODE_TLS_REJECT_UNAUTHORIZED=0`.

## 8. Verify Before Claiming Done

**A build passing is not the feature working.**

Before reporting completion, run and report actual output:
- `npm run build` in both projects
- `npm test` in both projects, plus `npm run test:e2e` in `backend/`
- Exercise the real endpoint (`curl`) — including its failure paths (validation, unreachable dependency), not just the happy path

If something fails or you skipped a step, say so plainly with the output. Never report a partial result as complete.

## 9. Project Conventions

- **Backend:** one folder per feature under `src/`, containing `*.module.ts`, `*.controller.ts`, `*.service.ts`, and `dto/`. Controllers stay thin; data access lives in the service. Validate every request body with a DTO and `class-validator`.
- **Frontend:** standalone components, signals for state. The app is a single page rendered by the root `App` component, with no router. Services in `core/services/`, models in `core/models/`. Never hardcode the backend host — call `/api/...` and let `proxy.conf.json` forward it.
- **Optional integrations** must degrade, not crash: if their config is absent the app still boots and only their own routes report the failure.
- Config comes from environment variables with sensible defaults, read via `ConfigService`.

## 10. Build and Test Gotchas

- **Backend Jest runs as native ESM** (`@nestjs/config@12` is ESM-only; Jest cannot `require(esm)` before Node 24.9). Consequences: the `jest` object is **not** a global — `import { jest } from '@jest/globals'` in any spec that uses `jest.fn`/`jest.spyOn`; `jest.mock` is not hoisted — inject fakes through constructors instead. `describe`/`it`/`expect` stay global.
- `npm run lint` runs `eslint --fix` and rewrites files. Run it before `git add`, not after.
- Check exit codes, never piped output: `cmd > log 2>&1; echo $?`. `| tail` masks the status.
- The Postgres database for this repo is `epikrise-demo` (in the shared `epikrise-postgres` container on 5443), not `app`: `docker exec epikrise-postgres psql -U postgres -d epikrise-demo`.
- Ports: backend 3101, frontend 4301. 4200 belongs to another project.
- Entity relation properties must be typed `Relation<T>` (from `typeorm`). Under ESM Jest, `emitDecoratorMetadata` otherwise emits a runtime reference to the other entity class and hits a circular-import TDZ error.
- Code loaded by Jest must not rely on `process.loadEnvFile()` or other mutation of `process.env`: each test file gets its own copy. Read `.env` with `util.parseEnv` instead (see `src/database/data-source.ts`).
- Schema changes: `npm run migration:generate -- src/database/migrations/<Name>`, then add the class to `MIGRATIONS` in `src/database/data-source.ts`. The e2e config runs with `maxWorkers: 1`, because e2e specs share the dev database.
- Never `pkill -f` a pattern that also appears in your own command line. Stop the backend by the PID listening on 3101.
- `npm run build` in `backend/` deletes `dist/` and crashes a running `start:dev` (MODULE_NOT_FOUND). Restart the dev server after every backend build.
- ts-jest does not type-check here (`isolatedModules`), so a shape change can pass every spec and still break `nest build`. Run `npx tsc --noEmit -p tsconfig.json` in `backend/` before trusting a green test run.
- The chat calls the real model (gemma-4-31B-it). e2e tests override `AiService` with `test/support/fake-ai.ts`, so they never call it.
- `npm run test:e2e` uses the dev database and empties the `messages` table, i.e. the stored conversation.
- Run a single e2e spec with `npm run test:e2e -- test/<name>`. Plain `npx jest --config ./test/jest-e2e.json` skips `--experimental-vm-modules` and fails with TS5098.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
