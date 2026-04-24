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
- [ ] Day View: Add/Copy/Delete buttons change day count
- [ ] Day View: Prev/Next navigation, OOO toggle
- [ ] Field editing: double-click opens input, Enter saves, Escape cancels
- [ ] Field persistence: survives navigation and full page reload
- [ ] Trip header: name edit, undo reverts, reset restores defaults, export downloads JSON
- [ ] Week view: day cards clickable, correct count, Add Day works
- [ ] Todos: add/edit/delete/toggle/enter-to-add all functional
- [ ] Dashboard: trip cards render and navigate to trip page
- [ ] Dashboard: "+ New trip" button opens the NewTripModal (not chat)
- [ ] NewTripModal: name + DateRangePicker range → Create button enabled; submits and navigates to /trip/<slug>
- [ ] Chat agent TRIP_CREATE block → Apply adds trip to localStorage + navigates to /trip/<id>
- [ ] Chat agent TRIP_CREATE Dismiss removes block without creating a trip
- [ ] System prompt references Austin, TX as home base (no Seattle hallucination)
- [ ] No JavaScript console errors during interaction

## Ad-hoc GUI Exploration (daily only)

- [ ] Dashboard: navigate to /dashboard, verify >= 1 trip card renders
- [ ] Trip page: navigate to /trip/china-2026, verify week view loads
- [ ] Day view: toggle to day view, verify day content renders
- [ ] Day actions: Add/Copy/Delete buttons respond to clicks
- [ ] Chat: open FAB, verify drawer opens, close it
- [ ] Console: no JavaScript errors on any page
- [ ] Mobile: repeat dashboard + trip checks at 390x844 viewport

## DB Integrity (daily only — run `python3 scripts/db-audit.py`)

- [ ] `python3 scripts/db-audit.py` exits 0 (runs ALL checks below in one shot)
- [ ] trips table: china-2026 exists with valid JSON, ≥10 days, has name + startDate + destinations
- [ ] trips table: days 7-9 (Apr 28-30) have populated morning + afternoon fields
- [ ] trip_bookings table: china-2026 has ≥5 bookings, each with type (flight|hotel|train) + details array
- [ ] ticket file integrity: every ticketUrl in trip_bookings has a corresponding PDF on disk under `server/data/tickets/{trip_id}/`
- [ ] trip_todos table: valid JSON list if row exists, each item has text field
- [ ] conversations table: all rows have valid JSON in messages_json
- [ ] No updated_at timestamps in the future (UTC comparison)

## Context From Dev Agent

_Dev agent appends new checks here as features are built._

- [ ] Chat thinking indicator: after sending a message, `[aria-label="Thinking indicator"]` with `.thinking-text` appears while waiting for response
- [ ] Chat thinking indicator: text rotates to a different message after ~3 seconds
- [ ] Chat thinking indicator: disappears after response arrives or on error
- [ ] Chat TRIP_UPDATE: response with TRIP_UPDATE block shows Apply/Dismiss buttons, not raw JSON
- [ ] Chat TRIP_UPDATE: Apply button updates trip data in localStorage and shows "Applied to trip" badge
- [ ] Chat TRIP_UPDATE: Dismiss button removes action block without modifying trip data
- [ ] Chat MAP_LINKS: response with MAP_LINKS block shows tappable preview links + Apply/Dismiss buttons
- [ ] Chat MAP_LINKS: Apply button saves mapLinks to trip day, shows "Directions added" badge
- [ ] Chat MAP_LINKS: chained links show "Full day route" composite multi-stop link
- [ ] MapLinks component: multi-stop "Full day route" renders when links chain together
- [ ] Chat drawer: opens scrolled to the most recent message, even on reopen (close, scroll up, reopen → scrolled to bottom again)
- [ ] Chat drawer fullscreen: `button[aria-label="Full screen"]` in the drawer header expands drawer to fill the viewport (drawer gets `.fullscreen` class); toggling again via `button[aria-label="Exit full screen"]` restores the default bottom-sheet size
- [ ] Chat recovery: if sendMessage fetch is killed mid-flight but server persisted reply, drawer shows the assistant message without an error flash
- [ ] Trip persistence: editing a day field in the UI syncs to SQLite within 2s (debounced PUT)
- [ ] Trip persistence: clearing localStorage and reloading pulls server data (trip-data-persistence.spec.ts)
- [ ] Bookings: served from /api/trips/{id}/bookings (JWT-gated), NOT from repo source code
- [ ] Ticket PDFs: "View ticket" → signed URL → PDF streams with correct Content-Type
- [ ] Todos: server-persisted via /api/trips/{id}/todos, shared across devices
- [ ] Day-nav location: tapping the location text (or "No location" placeholder) in the day header opens an inline editor; Enter saves to trips store, Escape cancels, edits persist across day navigation
- [ ] MiniCalendar: weekday-aligned grid with Monday-first headers (M T W T F S S), each row has 7 columns, day 1 sits in the column matching its weekday, blank cells pad leading/trailing positions
- [ ] Todos isolation: each trip has its own todo list. A new trip with no server row shows empty (NOT seeded with China defaults). Adding/editing todos on trip A never bleeds into trip B. Backed by `tests/integration/backend/test_todos_api.py`, `tests/todos-isolation.spec.ts`, and `tests/unit/stores/todos.test.ts`.
- [ ] Remove trip: trash icon appears on hover over trip card on dashboard; clicking shows confirm dialog; confirming removes trip from dashboard, server (trips + bookings + todos + conversations), and localStorage
- [ ] Journal button: visible in DayView actions bar next to OOO toggle
- [ ] Journal drawer: opens on Journal button tap, shows day title + close button
- [ ] Journal itinerary checklist: renders non-empty travel/morning/afternoon/evening as checkable items
- [ ] Journal checklist: checking items persists after drawer close/reopen
- [ ] Journal body: textarea accepts text, auto-saves, persists after close/reopen
- [ ] Journal mood: 4 mood icons (Great/Good/Okay/Tough), selection persists
- [ ] Journal badge: Journal button shows accent badge when day has an entry, faint text when empty
- [ ] Journal MiniCalendar: days with journal entries show an extra dot indicator
- [ ] Journal drawer: closes on X button, Escape key, and backdrop click
- [ ] Journal block editor: text blocks render as seamless borderless textareas (no visible form boundaries)
- [ ] Journal block editor: "Add photo" button visible at bottom of block editor
- [ ] Journal migration: legacy entries with body + photos auto-migrate to blocks format on load
- [ ] Journal photo upload: POST /api/trips/{trip_id}/photos accepts image files, returns photoId
- [ ] Journal photo serving: signed URL serves photo without auth header
- [ ] Journal photo quota: 500MB per-trip limit enforced (413 on exceed)
- [ ] Bookings past/upcoming split: bookings with dates before today appear under a collapsed "Past bookings (N)" caret, not in the main list
- [ ] Bookings past toggle: clicking the "Past bookings" caret reveals past bookings with dimmed opacity; clicking again hides them
- [ ] Bookings: when all bookings are upcoming, no "Past bookings" caret appears
