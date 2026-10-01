# Pocket Planet Gardener

For now a very simple chat bot: an Angular frontpage with an input box and the
conversation, a NestJS backend that asks an AI model, and a PostgreSQL
database that stores every message. The functional solution description is in
`docs/pocket-planet-gardener-SD.md`.

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
| `AI_API_KEY`     | —             | Provider key. Empty makes sending a message answer `503` |
| `AI_MODEL`       | —             | Model id                                      |
| `AI_TIMEOUT_MS`  | `60000`       | Per-request ceiling                           |

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

| Method | Endpoint        | Description                                        |
| ------ | --------------- | -------------------------------------------------- |
| GET    | `/api/messages` | The whole conversation, oldest first               |
| POST   | `/api/messages` | Send `{ "text": "..." }`; returns it and the reply |

```bash
curl -X POST http://localhost:3101/api/messages \
  -H 'Content-Type: application/json' \
  -d '{"text":"Say hello"}'
# [{"id":1,"role":"user","text":"Say hello",...},
#  {"id":2,"role":"assistant","text":"Hello!",...}]
```

Each message is sent to the AI together with the stored conversation, so the
bot remembers what was said. The message and the reply are stored together
only once the AI has answered; if the AI fails, the request answers `503` and
nothing is stored.

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
├── app.module.ts            root module: config, TypeORM, messages
├── app.setup.ts             global /api prefix, validation pipe
├── main.ts                  bootstrap, CORS
├── database/
│   ├── data-source.ts       DataSource for the TypeORM CLI
│   └── migrations/
├── messages/
│   ├── messages.module.ts
│   ├── messages.controller.ts   GET + POST /api/messages
│   ├── messages.service.ts      history, AI call, storage
│   ├── message.entity.ts        messages table
│   └── dto/create-message.dto.ts
└── ai/
    ├── ai.module.ts
    ├── ai.service.ts            OpenAI-compatible adapter (no routes)
    └── ai.types.ts

frontend/src/app
├── app.ts / app.html        the chat page
├── app.config.ts            HttpClient provider
└── core/
    ├── models/message.ts
    └── services/message.service.ts
```
