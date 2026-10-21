# Implementation references

Primary documentation consulted October 21, 2026. These references describe the
underlying technologies, not evidence that this repository's integrations ran.

- Next.js same-origin rewrite configuration: https://nextjs.org/docs/app/api-reference/config/next-config-js/rewrites
- Next.js October security update: https://nextjs.org/blog/nextjs-security-update-october-14-2026
- React releases and version line: https://react.dev/versions and https://github.com/react/react/releases
- NestJS validation: https://docs.nestjs.com/techniques/validation
- NestJS rate limiting: https://docs.nestjs.com/security/rate-limiting
- NestJS/Prisma recipe: https://docs.nestjs.com/recipes/prisma (current recipe uses a newer Prisma major; this repository deliberately uses the versioned v6 API below)
- Prisma ORM v6 transactions and isolation: https://www.prisma.io/docs/orm/v6/prisma-client/queries/transactions
- Prisma ORM v6 CLI: https://www.prisma.io/docs/orm/v6/reference/prisma-cli-reference
- Node cryptography, random bytes and scrypt: https://nodejs.org/api/crypto.html
- OWASP session-management guidance: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- Nodemailer SMTP library: https://nodemailer.com/
- Mailpit container setup: https://mailpit.axllent.org/docs/install/docker/

Implementation choices such as the match scoring formula, approval workflow,
public-hub model and idempotency semantics are original to this repository, not
claims that a cited source prescribes this exact architecture.
