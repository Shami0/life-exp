# life-exp

A life-experience backend: daily tasks, exercise plans, and project timelines with micro-tasks, all with a **GitHub-style history** of how each day went.

Built step by step with TypeScript, Fastify, PostgreSQL and Drizzle ORM. Currently an API only, designed to become a multi-user product.

## Core ideas

**Plan vs. what happened.** A task is split in two so history can never be rewritten:

- `tasks`: the thing itself ("Pay rent", "Drink water").
- `task_occurrences`: that task on one specific calendar date. This is what you tick off, and what the heatmap reads.

**Day colours** are derived from what was scheduled that day, never set by hand:

| Colour | Meaning |
|---|---|
| Gray | Nothing scheduled |
| Green | Everything scheduled was done |
| Orange | Some done, some missed |
| Red | Scheduled, but nothing done |

**Frozen history.** Past days can't be edited. Deleting a task archives it: future pending occurrences are removed, past ones stay.

**Dates, not timestamps.** Calendar days are stored as `YYYY-MM-DD` and "today" is calculated in each user's own timezone.

## Rules

| | Tasks | Workouts *(planned)* |
|---|---|---|
| Missed | The day is closed and keeps its colour. A copy is carried over to today. | The day is closed and frozen. Nothing rolls over. |
| Late logging | Complete today's copy, never the old day. | Not allowed. |
| Repeat | One-off, daily, or chosen weekdays | Weekly schedule, repeats by default |

Project micro-tasks will be ordinary tasks with a scheduled date, so they get history and carry-over for free. Dependencies ("B can't start until A is done") auto-reschedule B to the day after A finishes.

## Tech stack

- **Runtime:** Node.js 20+, TypeScript (`tsx` for dev, `tsc` for production builds)
- **HTTP:** Fastify 5
- **Validation:** Zod (request bodies and environment config)
- **Database:** PostgreSQL 17 (Docker) with Drizzle ORM and drizzle-kit migrations
- **Auth:** JWT access tokens + rotating refresh tokens, Argon2 password hashing

## Architecture: modular monolith

One deployable app, split internally into feature modules that each own their code and tables. Each module has the same layers:

- **routes**: HTTP and validation only
- **service**: business rules
- **repository**: Drizzle queries only

```
src/
  app.ts                  # builds the Fastify app, registers modules
  server.ts               # starts listening
  config/env.ts           # validated environment variables
  db/
    client.ts             # Drizzle + pg pool, collects every module's schema
    migrations/           # generated SQL, committed to git
  shared/
    auth.plugin.ts        # JWT + app.authenticate guard
    dates.ts              # timezone-aware date helpers
    errors.ts             # AppError
  modules/
    health/
    users/
    auth/
    tasks/
```

Rules that keep modules separable:

1. A module never imports another module's repository or schema. It calls the other module's service.
2. Cross-module links are plain ID columns. The one exception is `users`, the foundation module, which other tables reference with a real foreign key.
3. `shared/` stays small. If it grows, something belongs in a module.
4. Every table has a `userId` and every query filters by it.

## Getting started

**Requirements:** Node.js 20+, Docker.

```bash
git clone <your-repo-url> life-exp && cd life-exp
npm install
cp .env.example .env        # then edit the values
docker compose up -d        # starts Postgres
npm run db:migrate          # applies migrations
npm run dev                 # starts the API with auto-reload
```

Check it's running:

```bash
curl localhost:3000/health
# {"status":"ok","db":"up","time":"..."}
```

### Environment variables

| Variable | Description | Default |
|---|---|---|
| `NODE_ENV` | `development`, `production` or `test` | `development` |
| `PORT` | HTTP port | `3000` |
| `HOST` | Bind address | `0.0.0.0` |
| `DATABASE_URL` | Postgres connection string | required |
| `JWT_SECRET` | At least 32 characters. Generate with `openssl rand -base64 48` | required |
| `ACCESS_TOKEN_TTL` | Access token lifetime | `15m` |
| `REFRESH_TOKEN_DAYS` | Refresh token lifetime in days | `30` |

Example `.env`:

```
NODE_ENV=development
PORT=3000
DATABASE_URL=postgres://life:life@localhost:5433/life_exp
JWT_SECRET=replace-with-a-long-random-string
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_DAYS=30
```

The compose file publishes Postgres on host port **5433** (not 5432) to avoid clashing with a Postgres installed on your machine. Keep `DATABASE_URL` in sync with it.

### Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Run with `tsx watch`, reading `.env` |
| `npm run build` | Compile to `dist/` using `tsconfig.build.json` |
| `npm start` | Run the compiled app from `dist/` |
| `npm run typecheck` | Type-check without emitting files |
| `npm run db:generate` | Generate a migration from schema changes |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:studio` | Open Drizzle Studio to browse data |

### Database workflow

1. Edit a `src/modules/*/*.schema.ts` file.
2. `npm run db:generate`
3. Read the generated SQL in `src/db/migrations`.
4. `npm run db:migrate`

Never change tables by hand in `psql`. Commit the migrations folder.

## API

All `/tasks` and `/users` routes require `Authorization: Bearer <accessToken>`. Calendar dates are `YYYY-MM-DD`.

### Health and auth

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Server and database status |
| POST | `/auth/register` | `{ email, password, timezone? }` returns user and tokens |
| POST | `/auth/login` | `{ email, password }` returns user and tokens |
| POST | `/auth/refresh` | `{ refreshToken }` returns a new pair; the old refresh token is revoked |
| POST | `/auth/logout` | `{ refreshToken }` revokes it |
| GET | `/users/me` | The current user |

Reusing an already-rotated refresh token revokes all of that user's sessions.

### Tasks

| Method | Path | Description |
|---|---|---|
| POST | `/tasks` | Create a task: `{ title, notes?, date?, repeat? }` |
| GET | `/tasks/occurrences?date=` | Day view (defaults to today) |
| PATCH | `/tasks/occurrences/:id` | `{ status: "pending" \| "done" }`, today's occurrences only |
| PATCH | `/tasks/:id` | Update `title`, `notes`, or the repeat rule (recurring tasks only) |
| DELETE | `/tasks/:id` | Archive the task |

`repeat` is one of:

```json
{ "type": "none" }
{ "type": "daily" }
{ "type": "weekdays", "days": [1, 3, 5] }
```

Weekdays use ISO numbering: 1 = Monday ... 7 = Sunday.

Recurring occurrences are generated lazily when a day is viewed, never for past days, and never duplicated (unique on task + date).

### Try it

```bash
curl -s -X POST localhost:3000/auth/register \
  -H 'content-type: application/json' \
  -d '{"email":"me@example.com","password":"supersecret123","timezone":"UTC"}'

curl -s -X POST localhost:3000/tasks \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"title":"Drink water","repeat":{"type":"daily"}}'

curl -s localhost:3000/tasks/occurrences -H "authorization: Bearer $TOKEN"
```

## Roadmap

- [x] 1. Project setup (Fastify, TypeScript, Zod env, Docker Postgres, health check)
- [x] 2. Drizzle + Postgres, first migration, users table
- [x] 3. Auth (register, login, JWT access + refresh tokens)
- [x] 4a. Tasks and occurrences: one-off CRUD
- [ ] 4b. Recurring tasks (daily / weekdays)
- [ ] 4c. Day closing and carry-over (`lastClosedDate`, missed tasks, frozen days)
- [ ] 5. History endpoints: tasks heatmap
- [ ] 6. Exercise: library, plans, weekly schedule
- [ ] 7. Workout sessions, set logs, personal records, exercise heatmap
- [ ] 8. Projects, phases (with target dates), dependencies, auto-reschedule
- [ ] 9. Combined overview heatmap, tests (Vitest), polish

### Planned design notes

**Exercise** is a separate module with layers: an exercise library (each exercise declares what it tracks: reps, weight, duration, distance), workout plans, a repeating weekly schedule, and sessions with per-set logs. Targets are copied into each session so editing a plan never rewrites past workouts. Personal records are computed from set logs. Units are stored canonically (kg, metres, seconds). The timer runs in the client; the API stores the final duration.

**Projects** are project, then phases (milestones with target dates), then micro-tasks. Micro-tasks can exist without a date (a project backlog). Tasks have a single scheduled date plus optional `estimatedDays`, used only for Gantt bars and reschedule math. Phases are flagged "at risk" if rescheduling pushes past a deadline. The design leaves room for assignees later (a nullable `assigneeId` and a `project_members` table).

**History** has three views: tasks, exercise, and a combined overview.

## License

Private project, no license chosen yet.