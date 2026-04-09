# Guardian Claude Checklist

Permanent regression guards. Guardian Claude runs these on every invocation.
Edit this file to add new checks. Dev agent adds entries when new features are built.

## Always Run (hook + daily)

- [ ] `npm run check` — svelte-check + TypeScript must pass (0 errors)
- [ ] `npm run build` — Vite build must succeed
- [ ] `npx vitest run` — all unit tests must pass (0 failures)
- [ ] FastAPI health: `curl -sf https://api.heatherandwesley.com/health` returns 200
- [ ] Auth endpoint: `POST https://emwkjk2c9d.execute-api.us-east-1.amazonaws.com/prod/auth/login` with empty body returns 400
- [ ] Chat API: `GET https://api.heatherandwesley.com/api/chat/conversations/test` with invalid auth returns 401

## Playwright E2E (daily only)

- [ ] `npx playwright test` — all tests pass (0 failures)
- [ ] Chat FAB visible on trip page (desktop + mobile)
- [ ] Auth flash: authenticated user never sees login form
- [ ] Chat drawer opens/closes
- [ ] Send/receive message (mocked or live)

## Ad-hoc GUI Exploration (daily only)

- [ ] Dashboard: navigate to /dashboard, verify >= 1 trip card renders
- [ ] Trip page: navigate to /trip/china-2026, verify week view loads
- [ ] Day view: toggle to day view, verify day content renders
- [ ] Day actions: Add/Copy/Delete buttons respond to clicks
- [ ] Chat: open FAB, verify drawer opens, close it
- [ ] Console: no JavaScript errors on any page
- [ ] Mobile: repeat dashboard + trip checks at 390x844 viewport

## DB Integrity (daily only, post-021)

- [ ] conversations table: all rows have valid JSON in messages_json
- [ ] trips table: china-2026 exists with version >= 1 (when 021 lands)
- [ ] No updated_at timestamps in the future

## Context From Dev Agent

_Dev agent appends new checks here as features are built._
