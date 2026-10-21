# Security and privacy boundaries

Do not publicly expose the local preview or use real student/driver data in it.
The demo accounts and password are intentionally public, and the `.example` campus
addresses do not deliver external email. All coordinates are fictional hub data.

## Implemented controls

- Passwords use Node's salted scrypt; sessions are random 256-bit tokens hashed
  before storage. Password reset invalidates existing sessions.
- Verification/reset codes are hashed in ActionToken, expire, and are single-use.
  Undelivered email content necessarily contains codes in the private outbox; it
  must be protected as sensitive data and is removed after successful delivery.
- HttpOnly / SameSite=Strict sessions; HTTPS configuration uses Secure and the
  `__Host-` cookie prefix. There are no localStorage authentication tokens.
- Mutation requests require the exact configured Origin, JSON, and a custom
  header. That header is not a secret; it relies on browser same-origin/CORS rules.
  No broad CORS policy is enabled. It does not protect a user after an XSS compromise.
- Persistent rate buckets apply to account endpoints, emails and authenticated
  users. Proxy forwarding is not blindly trusted. Configure only audited hops.
- Server-enforced role/ownership/campus checks, no role assignment from profile
  inputs, and same-transaction checks for business state.
- Peer responses never include user passwords/emails or other students' schedules.
  Only a display name, public hubs and declared vehicle information are shared.
- Messages are text, not HTML. React renders escaped content; preview templates
  escape dynamic text/attributes. Both have explicit participant checks.
- SQL integrity constraints and ORM parameterization; application inputs never
  select an arbitrary table or column. Audit events omit passwords/tokens.
- 32 KB JSON body limits; bounded query results and field lengths.

## Residual risks / not implemented

No identity/age/enrollment/driver-license/insurance verification, background checks,
physical safety assurance, emergency operations, payments, university SSO, MFA,
or real-time GPS. Verified email is **not** a badge of trustworthiness. Vehicle
accommodations and trip completion are self-reported. Never infer safety from the
matching score. Public hubs are a design choice, not a safety guarantee.

The local JSON store has a single-process mutex and atomic file replacement, not
cross-process database transactions or encrypted storage. It is for tests/demo only.
PostgreSQL SSI correctness still needs execution of the provided integration suite.
The mail worker uses at-least-once delivery; a crash can result in duplicate email.
Retries stop after five failures and require operator follow-up. Production must
add retention/cleanup for tokens, rate buckets, old messages and closed incidents,
plus account deletion/export appropriate to the deployment. Overdue offers and
old pending bookings require reconciliation. List/read caps are documented.

There is no live dependency scan or external security audit in this release.
Next.js/NestJS builds, Docker images, SMTP integration, reverse-proxy behavior and
production HTTPS have not been validated here. The production API configuration
refuses HTTP and demo mode, but configuration checks alone do not make a service
production-ready. Remove seeded users before any real deployment.

## Disclosure

Do not put credentials or private records into a public issue. If you publish this
repository, enable GitHub private vulnerability reporting and add your own security
contact. Do not advertise a nonexistent reporting address or security team.
