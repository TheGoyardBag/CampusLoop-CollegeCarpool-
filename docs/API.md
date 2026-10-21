# CampusLoop HTTP API

The full NestJS adapter and the local preview delegate to the same `ApiRouter`.
Use the browser's same-origin `/api` routes. Payloads are JSON except calendar
exports. Core input validation is shared; adding a new controller alone does not
bypass it. The default body limit is 32 KiB.

## Authentication and request headers

Login sets a revocable **HttpOnly, SameSite=Strict** session cookie. HTTPS origins
use the `__Host-campusloop` cookie with `Secure`; the loopback HTTP development
cookie is `campusloop_session`. The API never returns a session token in JSON.

All mutations require:

```http
Origin: http://localhost:3400
Content-Type: application/json
X-CampusLoop-Client: web
```

Use `http://localhost:3000` as the origin for the real Next.js application instead.
The configured origin must match exactly. The frontend supplies these headers and
same-origin cookie credentials; ordinary GET requests still require authentication
unless listed as public below.

Errors use a stable shape:

```json
{"error":{"code":"RIDE_FULL","message":"This ride has no seats left.","requestId":"example"}}
```

This is an illustrative error shape; messages and codes are defined in the shared
service. Common statuses: 400 invalid input, 401 no session, 403 forbidden, 404
missing/not visible, 409 conflict, 413 oversized body, and 429 rate limit. Do not
build control flow from human-readable error messages.

## Public / account endpoints

| Method | Path | Body / result |
|---|---|---|
| GET | `/api/health` | Storage liveness and application/demo mode |
| GET | `/api/catalog` | Configured campuses and public pickup hubs |
| POST | `/api/auth/register` | `{name,email,password,campusId}`; generic 202 response |
| POST | `/api/auth/verify` | `{token}`; consumes a one-time verification token |
| POST | `/api/auth/login` | `{email,password}`; sets the session cookie |
| POST | `/api/auth/logout` | `{}`; revokes the session and clears the cookie |
| POST | `/api/auth/request-reset` | `{email}`; generic 202 response |
| POST | `/api/auth/reset` | `{token,password}`; changes password and revokes sessions |

Registration/verification emails go to the transactionally written outbox. The
preview exposes no mailbox endpoint: use the local CLI. The SMTP worker handles
mail in the full stack. **Resending expired verification tokens is not implemented
in this version**; add a rate-limited recovery flow before onboarding real users.

## Profile and private schedules

| Method | Path | Scope |
|---|---|---|
| GET / PATCH | `/api/me` | Own profile; editable fields are `name` and `homeHubId` only |
| GET | `/api/summary` | Own trip, schedule, unread counts, suggested commute date |
| GET / POST | `/api/courses` | Own recurring class blocks |
| DELETE | `/api/courses/:id` | Own class only |
| GET / POST | `/api/vehicles` | Own vehicles only |

Create a weekly class (weekday **1 = Monday, 7 = Sunday**):

```json
{"name":"CS 301","weekday":1,"start":"09:00","end":"10:15","termStart":"2026-10-01","termEnd":"2026-12-18"}
```

Create a vehicle:

```json
{"label":"Toyota Prius","color":"Silver","seats":3,"accessible":false}
```

Vehicle accommodation is self-reported. Private classes and peer email addresses
are not included in ride discovery results.

## Ride discovery and offers

`GET /api/matches` accepts:

| Query | Meaning |
|---|---|
| `date` | Local ISO date, `YYYY-MM-DD` |
| `direction` | `TO_CAMPUS` or `FROM_CAMPUS` |
| `targetTime` | Optional campus-local `HH:mm`; otherwise use classes |
| `bufferMinutes` | 0–60 minutes, default 10 |
| `maxWalkMeters` | 0–10000, default 3000; straight-line estimate, NOT routing |
| `maxCostCents` | 0–3000, default 1500; informational contribution |
| `quiet`, `accessible`, `includeWaitlist` | Literal `true` or `false` |

The home pickup hub comes from the authenticated profile, not an arbitrary
user-provided address. A match score is a deterministic fit score, **not a safety
rating, probability, travel-time prediction, or machine-learning output**.

Create an offer using `POST /api/rides`:

```json
{
  "vehicleId":"car-leo",
  "originHubId":"hub-oak",
  "destinationHubId":"hub-campus",
  "direction":"TO_CAMPUS",
  "date":"2026-11-02",
  "departure":"08:05",
  "arrival":"08:30",
  "capacity":3,
  "costCents":300,
  "quiet":true
}
```

Choose a future date appropriate to your environment. Optional `repeatUntil` and
`weekdays:[1,3,5]` create a bounded series in one transaction. The response is an
array of real ride occurrences. Ambiguous/nonexistent DST times are rejected;
there is no guessed offset. All persisted ride instants are UTC.

`GET /api/rides/mine` lists own offers; `GET /api/rides/:id` provides the
same-campus, privacy-filtered ride view.

## Requests, approval, waitlists

```http
POST /api/rides/:id/bookings
Idempotency-Key: example-unique-request-key
Content-Type: application/json
X-CampusLoop-Client: web
Origin: http://localhost:3400

{"note":"I will be at the public pickup hub.","waitlist":true}
```

Use a fresh random key for a new operation and reuse the same key when retrying
that operation. Different content under the same key is rejected. A request does
not consume capacity. `waitlist` opts into a waitlisted request when no confirmed
seat is available. Terminal bookings cannot be re-requested in this version.

| Method | Path | Allowed actor |
|---|---|---|
| GET | `/api/bookings` | Own bookings |
| GET | `/api/driver/requests` | Requests on own offers |
| POST | `/api/bookings/:id/approve` | Ride driver |
| POST | `/api/bookings/:id/decline` | Ride driver |
| POST | `/api/bookings/:id/cancel` | Booking owner |
| POST | `/api/rides/:id/cancel` | Driver or moderator |
| POST | `/api/rides/:id/complete` | Driver, after scheduled arrival |

All capacity, ownership, overlap and state checks repeat inside the write
transaction. Cancellation returns an allocated seat only once. Waitlist promotion
creates an approvable request, not an automatic seat reservation.

## Coordination and moderation

| Method | Path | Purpose |
|---|---|---|
| GET / POST | `/api/rides/:id/messages` | Driver/confirmed rider conversation; POST `{text}` |
| GET | `/api/rides/:id/calendar.ics` | Participant-only calendar download |
| GET / POST | `/api/rides/:id/reviews` | Reviews; POST `{rating,comment}` after completion |
| POST | `/api/rides/:id/report` | Private report `{reason}` |
| GET | `/api/notifications` | Own notifications |
| POST | `/api/notifications/:id/read` | Mark owned notification read |
| GET | `/api/admin/reports` | Moderator-only report queue |
| POST | `/api/admin/reports/:id/resolve` | Moderator-only resolution `{resolution}` |

Read access to a canceled rider's conversation is revoked. Messages are plain
text, never interpreted as HTML. Thread writes stop once a ride is closed. No
external messages, payments, live GPS, or emergency actions are sent by this API.
