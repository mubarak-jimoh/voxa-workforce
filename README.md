# Voxa Workforce

[![CI](https://github.com/mubarak-jimoh/voxa-workforce/actions/workflows/ci.yml/badge.svg)](https://github.com/mubarak-jimoh/voxa-workforce/actions/workflows/ci.yml)

An AI workforce platform for small businesses. You hire a digital employee, give them work in plain English, and inspect exactly what they did.

The first employee is **Avery**, a Lead Handler who researches prospects, prepares briefs and drafts outreach. Anything that leaves the business, such as sending an email, waits for a human to approve it.

## The idea: an AI that does not pretend

Most AI assistants will happily say "Done!" when nothing happened. Voxa is built around the opposite rule: **Avery never claims work that did not happen.**

- If no language model is connected, Avery says so instead of faking a reply.
- If web research is not connected, Avery records the brief and says research is unavailable. It does not invent companies.
- Research results only include rows that came back from the search provider. Zero results is reported as zero results.
- Sending anything creates an approval request. Nothing is marked as sent until it is.
- If the model tries to turn a request for advice into a "completed task", a policy layer demotes it back to conversation.

Each of these rules has a test.

## Features

- **Organisations and teams**: sign up, create an organisation, invite people by link, with owner, admin and member roles
- **Chat-style assignment**: tell Avery what you need; the platform decides whether it is conversation or real work
- **Tasks, activity, approvals and schedules**: every piece of work has a status, a trail of what happened and any artifacts it produced
- **Web research** through Tavily, with quality filtering that drops directory and aggregator sites
- **Deadlines and priorities** understood from natural language in the Europe/London timezone
- **Pause, resume and cancel** for the employee and for individual tasks
- **Durable execution** with Inngest: work survives restarts, and retries do not duplicate research or approvals
- **AI usage tracking** per organisation

## Architecture

```
app/                     Next.js routes. Thin: they compose the platform
platform/                The kernel
  auth/                  Better Auth: email and password, organisations
  tenant/                Loads the current organisation and enforces scope
  work/                  Tasks, state machine, deadlines, priorities, execution
  ai/                    Model adapter, decision schema, policy, tools, usage
  research/              Research pipeline, provider adapters, quality filter
  db/                    Drizzle schema
employees/lead-handler/  The first employee pack: role, prompt and planner
integrations/inngest/    Durable background execution
drizzle/                 SQL migrations
tests/                   20 test files, 118 tests
```

### Decisions I made

- **Multi-tenant from the first line.** Every query takes a `WorkScope` that carries the organisation. Tests create two organisations and prove that tasks, activity, artifacts and approvals never leak between them, including from background worker payloads.
- **The platform knows nothing about any one employee.** `platform/` must not import from `employees/`. A test walks the source tree and fails the build if that boundary is crossed. Adding a second employee means adding a pack, not editing the kernel.
- **The model proposes, code decides.** The model returns a structured decision that is validated with Zod. A policy layer then checks it against what was actually asked and which tools are really connected, and can overrule it.
- **Adapters for everything external.** The language model and the research provider sit behind interfaces, with fixture adapters for tests. The whole suite runs with no API keys and no network.
- **No database to install.** Local development and tests use PGlite, a PostgreSQL-compatible engine that runs in-process. Production uses real PostgreSQL through the same Drizzle schema.
- **Retries are safe.** Background steps are idempotent: a retried job skips completed steps, so research and approvals are never duplicated.

## Run it locally

You need Node.js 20.9 or newer. No database or API keys are required.

```bash
git clone https://github.com/mubarak-jimoh/voxa-workforce.git
cd voxa-workforce
npm install
cp .env.example .env.local
```

Set `BETTER_AUTH_SECRET` in `.env.local` to a random value of at least 32 characters:

```bash
openssl rand -base64 32
```

Then:

```bash
npm run db:migrate
npm run dev
```

Open http://localhost:3000 and create an organisation. You land on Avery's home, ready for work.

To enable real replies and research, add `OPENAI_API_KEY` and `TAVILY_API_KEY` to `.env.local`. Without them, Avery tells you what is not connected.

### Optional: real PostgreSQL

```bash
docker compose up -d
```

Then set `DATABASE_URL="postgresql://voxa:voxa@localhost:5432/voxa"` in `.env.local` and run `npm run db:migrate`.

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

`npm run check` runs all four. GitHub Actions runs them on every push.

The 118 tests cover tenant isolation, permissions, the work state machine, deadline and priority parsing, research grounding, durable execution and the "does not pretend" rules above.

## Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `BETTER_AUTH_SECRET` | Yes | Signs auth cookies. At least 32 characters |
| `BETTER_AUTH_URL` | Yes | Public address, for example `http://localhost:3000` |
| `PGLITE_DATA_DIR` | No | Where local PGlite data is stored. Defaults to `.data/voxa` |
| `DATABASE_URL` | No | Use real PostgreSQL instead of PGlite |
| `OPENAI_API_KEY` | No | Enables Avery's language model |
| `TAVILY_API_KEY` | No | Enables web research |
| `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` | No | Durable execution in production |

## Limits and next steps

- Invitations are shared as a copyable link. Email delivery is not built yet.
- Schedules are saved as configuration. A live scheduler is the next piece.
- Sending email is an approval flow only. No email provider is connected.
- There is one employee pack. The boundary is in place for more.

## Tech

Next.js 16, React 19, TypeScript, Drizzle ORM, PostgreSQL and PGlite, Better Auth, Inngest, Zod, Tailwind CSS, Vitest and GitHub Actions.
