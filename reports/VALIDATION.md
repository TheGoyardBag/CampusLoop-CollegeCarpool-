# CampusLoop validation report

**Release checked:** October 21, 2026. This report distinguishes executed checks
from supplied source/configuration. No cloud deployment or GitHub write occurred.

## Executed successfully

| Check | Observed result |
|---|---|
| Shared core TypeScript compilation | `tsc -p packages/core/tsconfig.json` passed in strict mode with global TypeScript **5.8.3** and Node typings available in the environment. The install manifest requests TypeScript 5.9.3, which was not downloaded here. |
| Source syntax pass | 25 TypeScript/TSX files parsed and single-file transpiled without syntax diagnostics. This is **not** a dependency-resolved Next.js/NestJS typecheck or build. See `syntax-results.json`. |
| Domain, matching, security, store, HTTP tests | **100 passed, 0 failed, 0 skipped**, under Node.js **22.16.0**. Full TAP: `node-tests.tap`. |
| Browser scenario | **16 checks passed**, no uncaught page errors. See `browser-results.json`. |
| Preview JavaScript parse checks | `node --check demo/preview.js` and `node --check demo/server.cjs` passed. |
| PostgreSQL suite gating | The integration test command **skipped all 5 tests** without the explicit environment flag. This only checks safe gating, not PostgreSQL functionality. |

The Node tests include last-seat and overlapping-trip races against the serialized
**memory adapter**, rollback, booking idempotency and mismatch rejection,
cancellation/seat return, waitlist transitions, ownership and cross-campus access,
private schedules, login/reset/session behavior, request origin/header checks,
plain-text messages, moderation, outbox leases/retries, recurrence, DST edge cases,
and actual Node HTTP request handling.

## Browser test transport

Direct Chromium navigation to a local URL was blocked by an administrative browser
policy (`ERR_BLOCKED_BY_ADMINISTRATOR`). The scenario loaded the actual preview
HTML/CSS/JavaScript into Chromium and relayed its fetch calls through Python to a
**running Node HTTP preview server using the shared compiled application core**.
Cookie persistence was supplied by Python's cookie jar.

It exercised login, match filters, seat request, driver approval, participant
messaging, calendar response, reporting, class creation, vehicle creation, offer
publishing, moderation resolution, and a mobile-width overflow check.

This is not a native browser cookie/SameSite enforcement test, a Next.js rendering
test, a NestJS routing test, a PostgreSQL concurrency test, or an accessibility
audit. The separate Node security tests verify API origin/cookie validation at the
request layer. Screenshots in `docs/` depict the **local preview** with fictional
records, not a full-stack production deployment.

## Fresh-archive verification

The release ZIP was extracted into a new directory with **no `node_modules`** and
no local database or environment file. All **100 Node tests passed again**. The
preview started from the extracted files, served its HTML entry point, and returned
HTTP 200 with a healthy application response. Both preview JavaScript syntax
checks passed. See `fresh-archive-tests.tap`.

The archive excludes local state, secrets, dependency directories and generated
framework build directories. `reports/SHA256SUMS.txt` lists SHA-256 hashes for the
included files other than itself. The compiled shared core is intentionally
included under `demo/compiled` to allow an install-free preview.

## Not executed / not established

- npm registry installation was blocked (`EAI_AGAIN`). No fabricated lockfile is
  included; install and review dependencies, commit a real lockfile, then use `npm ci`.
- Full Next.js/React and NestJS dependency-resolved typechecking and production builds.
- Prisma CLI schema validation, generated client execution, actual migrations,
  PostgreSQL transactions/constraints/races, and SMTP worker delivery.
- Docker/Compose builds and runtime startup.
- The five real PostgreSQL integration tests and two actual Next.js/NestJS
  Playwright tests. Source and CI jobs are supplied for running them.
- npm dependency audit, hosted CI, cloud hosting, load tests, independent security
  testing, and end-to-end accessibility testing.
- Actual student/driver identity, enrollment, insurance, licenses, road travel
  times, vehicle accommodations, ride completion, adoption, or cost/emission savings.

**The tested application core is shared with the full stack; adapter and framework
validation remains a separate requirement.** The preview's file store is not an
alternative to database concurrency testing. Production readiness is not claimed.

## Reproduce the completed checks

```bash
node --test tests/*.test.cjs
node --check demo/preview.js
node --check demo/server.cjs
```

With TypeScript dependencies installed:

```bash
npm run build:core
node scripts/sync-demo.cjs
npm test
```

With Python Playwright + Chromium:

```bash
python scripts/browser-smoke.py --chromium /path/to/chromium
# Only when native browser navigation is restricted:
python scripts/browser-smoke.py --bridge --chromium /path/to/chromium
```

For the framework, database, Docker and real-browser checks, follow
`docs/DEVELOPMENT.md`. Record new results here rather than treating supplied CI
configuration as proof that it has run.
