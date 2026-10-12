# LoopLab

A small Node.js + Express + TypeScript server that schedules jobs with timers. Later it will also show how busy the event loop is.

LoopLab is a **learning project**. The goal is to understand the Node.js event loop (timers, microtasks, blocking) by building and running real experiments. The full spec is in [docs/PRD.md](docs/PRD.md).

## Status

| Milestone | State |
|---|---|
| 0. Setup | Done |
| 1. Timers (one-time jobs, recurring jobs, cancel) | Done |
| Small web page to create and watch jobs | Done (extra, not in the PRD) |
| 2. Order logger (`nextTick`, promises, `setTimeout`, `setImmediate`) | Not started |
| 3. Block the loop experiments | Not started |
| 4. Lag monitor, graceful shutdown, tests | Not started |

## Requirements

- Node.js 20 or newer

## Quick start

```bash
npm install
npm run dev
```

Then open <http://localhost:3000> for the web page, or use the API below. The server listens on port `3000`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Runs the server with `tsx watch` and restarts on file changes |
| `npm run typecheck` | Runs `tsc --noEmit` (strict mode) |
| `npm test` | Runs Vitest (no tests written yet) |

## API

All bodies are JSON. Errors return `400` or `404` with `{ "error": "message" }`.

| Method and path | Input | Success response |
|---|---|---|
| `POST /jobs` | `message`, plus either `delayMs` or `intervalMs` | `201` with `id`, `type`, `status`, `runAt` |
| `GET /jobs` | none | `200` with a list of jobs |
| `GET /jobs/:id` | none | `200` with the job |
| `DELETE /jobs/:id` | none | `200` with `id` and `status: "cancelled"` |
| `GET /health` | none | `200` with `status`, `uptimeSec`, `pid` |

Validation rules:

- `message` is a string of 1 to 200 characters.
- Send exactly one of `delayMs` or `intervalMs`.
- `delayMs` is a whole number from 0 to 3,600,000 (1 hour).
- `intervalMs` is a whole number from 100 to 3,600,000.

Example:

```bash
# Run once, after at least 2 seconds
curl -X POST localhost:3000/jobs -H 'content-type: application/json' \
  -d '{"message":"hello","delayMs":2000}'

# Run again and again, every second
curl -X POST localhost:3000/jobs -H 'content-type: application/json' \
  -d '{"message":"tick","intervalMs":1000}'

# Cancel a job
curl -X DELETE localhost:3000/jobs/<id>
```

## How jobs work

- A **one-time** job uses `setTimeout`. The delay is a minimum, not an exact time.
- A **recurring** job uses a recursive `setTimeout`. The next run is scheduled only after the current run ends, so runs never overlap. The first run happens after one `intervalMs`.
- Job statuses: `scheduled`, `running`, `done`, `cancelled`, `failed`.
- Only a `scheduled` or `running` job can be cancelled. Cancelling uses `clearTimeout`, so the callback never runs.
- A job that throws is marked `failed` and logged. A failed recurring job stops. The server keeps running.
- Jobs are kept in memory (a `Map`). They are lost when the server restarts.

## Project structure

```text
src/
  server.ts          Express app and routes
  jobs/
    jobStore.ts      Job types and the in-memory Map
    scheduler.ts     Timers: one-time, recurring, cancel
    validate.ts      Input validation for POST /jobs
public/
  index.html         Web page: create jobs, watch them, cancel them
docs/
  PRD.md             Full spec and acceptance checklist
```

## Out of scope

Database, login, cron expressions, worker threads. See [docs/PRD.md](docs/PRD.md) section 3.
