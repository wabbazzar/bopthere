# H&W Travel Portal

Personal travel-planning app for Wesley & Heather. SvelteKit front end on
GitHub Pages, FastAPI backend on a home server (`wabbazzar-ice`) with a
small SQLite DB. The old React wedding site is archived at `/archive/`.

See [`CLAUDE.md`](./CLAUDE.md) for the full contributor playbook
(architecture, conventions, testing rules). This README is the short
orientation.

## Quick start

```sh
npm install
npm run dev -- --port 5174     # keep this running; see CLAUDE.md §0
```

The dev server talks to the production backend at `api.heatherandwesley.com`
by default. Set `PUBLIC_CHAT_API_URL` in `.env` to point at a local
backend instead.

## Architecture

| Layer | What | Where |
|-------|------|-------|
| Frontend | SvelteKit 2 + Svelte 5 + TypeScript, Tailwind for layout | `src/` — static-adapter build deployed to GitHub Pages |
| Chat / trip backend | FastAPI + SQLite (WAL), shells to Claude Code CLI for LLM | `server/`, runs on `wabbazzar-ice` as a systemd user unit |
| Auth | JWT (HS256, 30-day). Lambda + DynamoDB table `heatherandwesley-auth-users`. Being kept on AWS for now. | `aws/lambda/auth-handler.py` |
| Archive | Prebuilt React wedding site, served at `/archive/` | `static/archive/` |

Active development goes into `server/` on wabbazzar-ice, **not** AWS —
the Lambda/DynamoDB footprint is frozen to the auth path only.

## Server data model

Everything persists to `server/data/chat.db` (gitignored). WAL mode;
tiny today (~64 KB). All four tables are keyed by `trip_id` — there is
**no per-user partitioning**, Wesley and Heather share one row per trip.

| Table | Primary key | Columns | Contents |
|-------|-------------|---------|----------|
| `trips` | `trip_id` | `trip_json`, `updated_at` | The full `Trip` object as JSON: `{id, name, startDate, endDate, destinations, links, days[]}`. Each `day` has `{date, dayOfWeek, location, travel, morning, afternoon, evening, accommodation, notes, ooo, mapLinks?}`. |
| `trip_bookings` | `trip_id` | `bookings_json`, `updated_at` | Flights + hotels: `[{type, label, date, confirmation, details[], bookingUrl?, ticketUrl?}]`. Seeded once from `server/data/bookings-seed.json` (renamed `.used` after ingestion). |
| `trip_todos` | `trip_id` | `todos_json`, `updated_at` | `[{text, done}]`. |
| `conversations` | `trip_id` | `messages_json`, `updated_at` | Full chat history: `[{id, role, content, timestamp, user}]`. |

Alongside the DB, ticket PDFs live at
`server/data/tickets/<trip_id>/*.pdf`. They're served via HMAC-signed
120 s URLs (`POST /attachments/sign` → `GET /attachments/{name}?exp=…&sig=…`)
so browsers can open them without a Bearer header.

### Sync semantics

- **Last-write-wins** on `updated_at` for `trips` and `trip_todos`.
  Stale writes get a 409 with the server's current state in the body so
  the client can reconcile in one round-trip.
- **Server is authoritative on init.** The client pushes any pending
  edits, then pulls the server version.
- **Trip discovery:** `GET /api/trips` returns `[{tripId, updatedAt}]` —
  the client uses it on init to pull any trips created on another
  device that aren't in localStorage yet.

### Writing to the DB directly

From `wabbazzar-ice`:

```sh
cd server/
python3 -c "from db import list_trips, get_trip; print(list_trips())"
```

## HTTP endpoints (server)

All require `Authorization: Bearer <JWT>` except `/health` and the
signed attachment URLs.

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/health` | Liveness |
| `GET` | `/api/trips` | List catalog `[{tripId, updatedAt}]` |
| `GET` | `/api/trips/{id}` | Fetch full trip |
| `PUT` | `/api/trips/{id}` | Upsert trip (LWW, validated: slug regex + body.id matches path + required fields) |
| `GET` | `/api/trips/{id}/todos` | Fetch todos |
| `PUT` | `/api/trips/{id}/todos` | Upsert todos (LWW) |
| `GET` | `/api/trips/{id}/bookings` | Fetch bookings |
| `POST` | `/api/trips/{id}/attachments/sign` | Issue a signed URL for a PDF |
| `GET` | `/api/trips/{id}/attachments/{name}?exp=…&sig=…` | Serve the PDF |
| `GET` | `/api/chat/conversations/{id}` | Fetch chat history |
| `POST` | `/api/chat/messages` | Send a message, get a Claude reply |
| `DELETE` | `/api/chat/conversations/{id}` | Clear history |

Trip ids are slugs: `^[a-z0-9][a-z0-9-]{0,47}$`.

## Chat agent tool-style blocks

The chat agent can emit structured blocks that the frontend renders as
action cards the user explicitly applies:

- ` ```TRIP_UPDATE ` — mutate a specific day/field.
- ` ```TRIP_CREATE ` — create a new trip (navigates to `/trip/<id>` on
  apply; the app seeds one empty day per calendar date by default).
- ` ```MAP_LINKS ` — add Google Maps directions for a day.

Rules and examples live in the system prompt built by
`src/lib/services/chat.ts`.

## Auth (legacy AWS)

JWT (HS256) from `POST /auth/login` at
`https://emwkjk2c9d.execute-api.us-east-1.amazonaws.com/prod`. Users live
in DynamoDB (`heatherandwesley-auth-users`). Tokens go into
`localStorage.hw-auth-token`. Root layout redirects unauthenticated users
to the login portal.

## Testing

```sh
npm test                       # vitest unit tests
npm run test:e2e               # Playwright
npm run check                  # svelte-check + TypeScript
bash scripts/guardian-claude.sh hook   # fast regression guard
bash scripts/guardian-claude.sh daily  # full: scripts + Playwright + GUI + DB
```

Testing rules in [`CLAUDE.md §10`](./CLAUDE.md). Notably: Svelte 5 hashes
CSS class names, so Playwright selectors must use `aria-label`,
`role`, text content, or `data-testid` — **never** a component's scoped
class name.

## Deployment

Frontend:

```sh
npm run build                  # static-adapter build to build/
# Pushed to main → GitHub Pages rebuild (~1–2 min)
```

Backend: systemd user service on wabbazzar-ice.

```sh
systemctl --user restart hw-chat
journalctl --user -u hw-chat -f
```

Nginx reverse-proxies `https://api.heatherandwesley.com` → `127.0.0.1:8089`.

## Repo layout (high level)

```
src/                    SvelteKit app
  routes/               pages (dashboard, trip/[id], login)
  lib/
    components/         UI (trip, chat, ui primitives like DateRangePicker)
    stores/             trips, chat, auth
    services/           API wrappers + chat-action parsers
    types/              Trip, ChatMessage, etc.
    data/               default trip seeds (china-2026.ts)
server/                 FastAPI backend
  chat_proxy.py         endpoints
  db.py                 SQLite helpers
  data/                 chat.db + tickets/ (GITIGNORED — contains real data)
aws/lambda/             legacy auth handler
static/archive/         prebuilt React wedding site
tests/                  Playwright specs + unit/ (vitest) + guardian-checklist.md
```
