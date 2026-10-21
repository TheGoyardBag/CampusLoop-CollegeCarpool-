# Portfolio and interview guide

## GitHub description

Schedule-aware college carpooling with Next.js, TypeScript, NestJS, PostgreSQL, and Prisma. Private class schedules, ranked ride matching, driver-approved bookings, waitlists, trip messaging, and transactional notifications. Includes a tested local preview and full-stack integration tests.

## Resume language

After running and validating the complete Next.js/NestJS/PostgreSQL implementation:

**CampusLoop — College Carpooling Application**—Built a full-stack carpooling
platform using Next.js, TypeScript, NestJS, PostgreSQL, and Prisma, matching rides
to private class schedules and implementing driver-approved bookings, transactional
seat allocation, waitlists, and participant-only trip coordination.

Before that integration validation, prefer:

**CampusLoop — College Carpooling Application**—Implemented schedule-aware ride
matching and booking workflows in TypeScript, with Next.js/NestJS application
source, Prisma/PostgreSQL persistence, and automated tests for authorization,
idempotency, schedule conflicts, and seat allocation.

Do not claim live adoption, traffic, real campus deployment, reduced emissions,
financial savings, verified driver safety, or PostgreSQL load-test results without
actually obtaining and documenting that evidence. This is not an AI project: the
matching score is a transparent deterministic heuristic.

## Demonstration sequence

1. Sign in as Maya (rider), inspect her private weekly schedule and ranked rides.
2. Request Leo's ride. Explain why REQUESTED does not reserve capacity or grant chat.
3. Sign in as Leo (driver), approve the request, and show the seat count and audit.
4. Return to Maya, send a message, download the calendar event, and cancel.
5. Demonstrate simultaneous last-seat approvals via the test suite. Distinguish
   memory-adapter tests from PostgreSQL SSI verification.
6. Open a report and resolve it as a moderator. Explain privacy boundaries.

## Questions you should be able to answer

- Where is authentication checked? Why isn't hiding a button authorization?
- What exactly happens when two requests compete for the same final seat?
- Why does serializable retry repeat the entire transaction, and why is SMTP outside it?
- Which information is public to peers, and which data never leaves the owner's API?
- What is an idempotency key, and what happens if the same key has different input?
- How are class times and UTC ride instants compared across daylight-saving transitions?
- Why is matching heuristic rather than machine learning? What would you measure?
- What are the tradeoffs of bounded reads, N+1 hydration, polling and a single API service?
- Which integrations were exercised locally, and which were not?

The most useful next step is completing the actual framework builds, PostgreSQL
race tests, and real-stack browser tests, then recording your own measurements.
