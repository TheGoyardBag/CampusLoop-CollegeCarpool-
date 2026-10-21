# Start here

**Project:** CampusLoop — College Carpooling Application

## 1. Try the working preview

With Node.js 22.16 or newer installed, open a terminal **inside this folder**:

```bash
node demo/server.cjs
```

Open `http://localhost:3400`. Choose **Rider** and sign in. Find a ride, request a
seat, then sign out. Choose **Driver**, open **Driver hub**, and approve Maya's
request. Sign back in as the rider to send a message and export the calendar event.
The source and tests run with no paid APIs or GPU.

The preview is a separate JavaScript UI + Node HTTP adapter using the real shared
TypeScript application core. It does **not** run Next.js, NestJS, or PostgreSQL.

## 2. Inspect the actual full-stack implementation

- `apps/web/components/CampusApp.tsx`: real React UI for the complete workflows.
- `apps/api/src/controller.ts`: explicit NestJS controllers.
- `apps/api/src/prisma-store.ts`: real Prisma database adapter with serializable retries.
- `packages/core/src/service.ts`: all account, class, matching, booking and trip logic.
- `prisma/schema.prisma`: the normalized relational schema.

Follow `docs/DEVELOPMENT.md` to install dependencies and run the full stack.
Internet/package-registry access and Docker or local PostgreSQL are required.
Those integration checks remain outstanding; see `reports/VALIDATION.md`.

## 3. Run checks

```bash
npm run test:offline
```

No npm installation is needed for those tests. After dependencies are installed,
run `npm test`, the complete builds, and the real PostgreSQL/Playwright suites.

## 4. Publish your source

Follow `docs/PUBLISH.md`. Upload the extracted source, **not only the ZIP**.
Do not upload `.local`, `.env`, databases, node_modules, or real people's records.

Suggested repository name: `campusloop-college-carpool`.

**No cloud account has been touched and nothing has been pushed to GitHub.**
