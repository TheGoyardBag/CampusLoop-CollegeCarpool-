# Development and verification

## Requirements

Node.js 22.16+, npm, PostgreSQL 17 (or Docker), internet access to npm and Prisma
engine binaries. Python/Playwright are optional for the separate preview browser
suite. The application uses no paid mapping or AI API.

The manifests pin Next.js 16.4.1 and React 19.3.1 and use the Prisma 6.19.3 line.
This is an intentional versioned Prisma integration, not code for Prisma 7/8.
Check security advisories before deployment. See `REFERENCES.md` for the official
sources consulted. Package installation was blocked here, so **no fake lockfile
is provided**. Generate and review a real `package-lock.json`, commit it, and then
switch CI/Docker installs to `npm ci` for locked builds.

## Native full-stack development

From the repository root (commands work in PowerShell, bash, and zsh):

```bash
node scripts/setup.cjs
npm install
npm run db:generate
docker compose up -d db mailpit
npm run db:migrate
npm run build:core
npm run build:api
node --env-file=.env scripts/seed.cjs
```

The seed is optional for a new real deployment but necessary for this fictional
walkthrough. It refuses nonempty databases and production mode; it never truncates
a database. `.env` defaults to a local demo configuration.

In separate terminals, from the same root:

```bash
npm run dev:api
npm run dev:web
npm run worker -w @campusloop/api
```

Open `http://localhost:3000`. Use the exact APP_ORIGIN; replacing localhost with
127.0.0.1 changes the browser Origin and deliberately fails mutation checks.
`dev:api` watches the compiled API; rerun `npm run build:core` / `build:api` after
source changes, or run the relevant `tsc --watch` commands in additional terminals.
Next.js handles its own development source updates.

Mailpit is at `http://localhost:8025`. Verification and reset messages are captured
locally, never delivered to a real `.example` email address. Enter their one-time
codes using the sign-in page's corresponding actions.

## Complete development stack with Docker

```bash
node scripts/setup.cjs
docker compose up -d --build
docker compose run --rm seed
docker compose logs -f api worker
```

DB and mailbox ports bind to loopback; the API is internal to the Compose network.
The frontend proxies `/api` to a fixed API origin. The Compose file is a development
recipe, not a tested production infrastructure deployment. There are no cloud writes.

```bash
docker compose down
```

The PostgreSQL volume remains. `docker compose down -v` deletes **all** local
Compose database data; use it only for a disposable environment. Seeding an already
seeded database will fail safely rather than silently overwrite it.

## Unit/domain/HTTP tests

```bash
npm run test:offline
npm test
npm run db:generate
npm run typecheck
npm run build
```

The first command uses the committed compiled TypeScript core. `npm test` rebuilds
that core and synchronizes the preview snapshot before executing the same tests.
The runtime copy has no external dependencies. Never edit `demo/compiled` directly.

## PostgreSQL integration tests (destructive test database only)

Create a separate database named **campusloop_test**. Set DATABASE_URL to it. The
suite refuses any other database name. Do not use a development database containing
records you care about.

PowerShell:

```powershell
$env:DATABASE_URL="postgresql://campusloop:YOUR_PASSWORD@localhost:5432/campusloop_test?schema=public"
$env:RUN_POSTGRES_TESTS="true"
npm run db:migrate
npm run build:core
npm run test:postgres
```

Bash/zsh:

```bash
export DATABASE_URL='postgresql://campusloop:YOUR_PASSWORD@localhost:5432/campusloop_test?schema=public'
export RUN_POSTGRES_TESTS=true
npm run db:migrate
npm run build:core
npm run test:postgres
```

These tests delete and reseed that fixed test database. They cover actual
PostgreSQL capacity races, constraints, rollback and timestamp conversion.
**They have not been run in the creation environment.** Remove the override before
returning to your normal development database.

## Real Next.js/NestJS browser tests

Use a freshly seeded disposable database (not one already modified by the preview):

```bash
npx playwright install chromium
npm run test:e2e
```

Both application servers must already be running at localhost:3000/4000. This test
suite targets the **real Next.js UI**, unlike the separately tested preview.

## Preview browser checks

```bash
python -m pip install playwright
python -m playwright install chromium
python scripts/browser-smoke.py --chromium /path/to/chromium
```

`--bridge` is only for environments where administrative browser policies prevent
loopback navigation. It uses a Python fetch/cookie transport to the real preview
HTTP server; it is not a native browser security test. The script starts a separate
in-memory preview on port 3492 and does not touch your persisted `.local/demo.json`.

## Production work still required

Remove demo accounts, configure real campus domains and verified SMTP, use HTTPS,
set the exact APP_ORIGIN and trusted proxy hops, use managed secrets, restrict DB
access, validate backups and restore, review retention and account-deletion
requirements, establish moderation/safety operations, run dependency audit and all
integration suites, and obtain independent security/accessibility review.
There is no production-readiness claim for this release.
