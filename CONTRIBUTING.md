# Contributing

Keep domain rules in packages/core, transport handling in apps/api, and React UI
in apps/web. Never bypass core authorization from a new controller. Add regression
tests for state transitions, access boundaries and clock-dependent behavior.

Run npm test, both framework builds, PostgreSQL integration tests and Playwright
before marking a feature complete. Changes to schema.prisma need a reviewed SQL
migration; custom check constraints belong in migrations. Keep docs and validation
claims aligned with what actually ran. Never add real student records, addresses,
credentials, or secrets to fixtures, screenshots, issues, or test output.
