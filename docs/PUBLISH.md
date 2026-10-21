# Publish to your GitHub

Create an empty repository named **campusloop-college-carpool**. Upload the extracted
source folder, not just the ZIP file. Run these commands inside that folder:

```bash
git init
git add .
git status --short
```

Review that `.env`, `.local`, real data, node_modules, build output and test
credentials from other environments are NOT staged. Only the intentionally public
fictional demo credentials belong in this repository.

```bash
git commit -m "Build schedule-aware campus carpooling application"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/campusloop-college-carpool.git
git push -u origin main
```

Replace YOUR_USERNAME. After npm can access the registry, generate and review the
real package-lock.json, run all checks, then commit it. Never invent a lockfile.
Enable Dependabot and private vulnerability reporting. The included CI workflows
will run only after you push; resolve any failures before describing integrations
as validated. No remote CI run occurred when this archive was authored.

Suggested topics: `typescript`, `nextjs`, `react`, `nestjs`, `postgresql`, `prisma`,
`full-stack`, `carpooling`, `scheduling`, `docker`, `rest-api`, `testing`.

See `PORTFOLIO.md` for a repository description and evidence-aware resume wording.
