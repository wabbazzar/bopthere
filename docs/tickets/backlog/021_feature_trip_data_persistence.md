# Ticket 021: Feature - Trip Data Persistence & Multi-User Sync

## Metadata
- **Status**: Not Started
- **Priority**: High
- **Effort**: 13 points (Phase 1: 3pt, Phase 2: 3pt, Phase 3: 3pt, Phase 4: 2pt, Phase 5: 2pt)
- **Created**: 2026-04-09
- **Type**: feature
- **Depends on**: Auth system (ticket 003, complete), chat server infrastructure (complete)

## Problem Statement

Trip data is stored in localStorage only. Wesley and Heather edit trip details on separate devices with no shared state. Edits on one device are invisible to the other, creating data conflicts. The day view's Add/Copy/Delete buttons modify local data but are confusing in context — users expect to tap fields and edit directly. Before making inline editing the primary UX, trip data must be backed by a database so both users converge on the same state.

## User Stories

### Primary
As a trip planner (Wesley or Heather), I want my trip edits to persist to a shared database so that both of us always see the latest version of our trip.

### Secondary
- As a trip planner, I want to tap a field in day view and edit it directly, knowing my change is saved and visible to my partner.
- As a trip planner, I want to see when data was last synced so I know I'm looking at fresh information.
- As a trip planner, I want the app to work offline and sync when connectivity returns.

## Infrastructure Context

**Existing server pattern (follow this):**
- The chat service already runs on **wabbazzar-ice** as a FastAPI app (`server/chat_proxy.py`) with SQLite (`server/db.py`), deployed as a **systemd user service** behind **Caddy** at `api.heatherandwesley.com`.
- Port 8089 is used by the chat service.

**Shredly2 pattern (reference for DB management):**
- Located at `/home/wabbazzar/code/shredly2`
- Uses **SQLite + WAL mode** with version-based conflict resolution
- Drizzle ORM for schema management (TypeScript)
- Version-based optimistic locking: `version` column, client sends version on write, server rejects if mismatch
- Systemd service behind Caddy reverse proxy
- Idempotent DB initialization (safe to call multiple times)

**Decision: Extend the existing FastAPI server** (`server/chat_proxy.py`) with trip CRUD endpoints, using the same SQLite database (`server/data/`) and the same systemd service. This avoids running a second service and reuses the existing JWT auth, CORS config, and Caddy routing.

## Technical Requirements

### Phase 1: SQLite Schema & Trip API Endpoints (3pt)

**Extend: `server/db.py`** — Add trips table alongside existing conversations table.

```sql
CREATE TABLE IF NOT EXISTS trips (
    trip_id TEXT PRIMARY KEY,
    trip_json TEXT NOT NULL,          -- Full Trip object as JSON
    version INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL,
    updated_by TEXT NOT NULL           -- username who last edited
);
```

- Same SQLite DB file (`server/data/chat.db` → consider renaming to `server/data/hw.db`)
- WAL mode already enabled
- Idempotent table creation (same pattern as existing `conversations` table)

**New functions in `server/db.py`:**
```python
def get_trip(trip_id: str) -> dict | None
    # Returns {trip_id, trip_json, version, updated_at, updated_by} or None

def save_trip(trip_id: str, trip_json: str, version: int, updated_by: str) -> dict
    # Optimistic lock: check version matches before writing
    # If match: write, increment version, return new state
    # If mismatch: raise ConflictError with current server state

def list_trips() -> list[dict]
    # Returns [{trip_id, name, start_date, end_date, destinations, updated_at}]
    # Parse name/dates/destinations from trip_json

def seed_trip(trip_id: str, trip_json: str, updated_by: str) -> bool
    # Insert only if trip_id doesn't exist (for initial seeding)
    # Returns True if inserted, False if already existed
```

**Extend: `server/chat_proxy.py`** — Add trip endpoints using same auth pattern.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/trips` | List all trips (summary). Auth required. |
| `GET` | `/api/trips/{trip_id}` | Fetch full trip. Returns `{ tripId, trip, version, updatedAt, updatedBy }`. Auth required. |
| `PUT` | `/api/trips/{trip_id}` | Save trip. Body: `{ trip, version }`. Auth required (admin only). |
| `POST` | `/api/trips/seed` | Seed a trip (admin only). Body: `{ tripId, trip }`. No-op if exists. |

**Optimistic Locking (following shredly2 pattern):**
1. Client fetches trip → receives `version: N`
2. Client sends `PUT` with `version: N`
3. Server checks `WHERE trip_id = ? AND version = ?`
4. If match → write succeeds, return `version: N+1`
5. If mismatch → return `409 Conflict` with `{ conflict: true, serverTrip, serverVersion }`
6. Client receives 409 → show "Trip was updated by {updatedBy}. Reload?" prompt

**Pydantic models:**
```python
class TripSaveRequest(BaseModel):
    trip: dict
    version: int

class TripSeedRequest(BaseModel):
    tripId: str
    trip: dict
```

### Phase 2: Trip Service & Store Migration (3pt)

**New file: `src/lib/services/trips.ts`**
- Follow pattern from `src/lib/services/chat.ts` (uses `PUBLIC_CHAT_API_URL`)
- Same base URL as chat: `https://api.heatherandwesley.com`
- Functions:
  - `fetchTrip(tripId: string): Promise<{ trip: Trip; version: number; updatedAt: string; updatedBy: string }>`
  - `saveTrip(tripId: string, trip: Trip, version: number): Promise<{ version: number; updatedAt: string }>`
  - `listTrips(): Promise<TripSummary[]>`
  - `seedTrip(tripId: string, trip: Trip): Promise<boolean>`
- Include `Authorization: Bearer <token>` header (reuse `getToken()` from auth.ts)
- Handle 409 conflict responses specifically

**Modify: `src/lib/stores/trips.ts`**
- Add `version` tracking per trip (stored alongside trip data)
- Add `syncStatus` state: `'synced' | 'saving' | 'conflict' | 'offline' | 'error'`
- On store mutation: save to localStorage immediately (instant feedback), then fire API save
- Debounce API saves (500ms) to avoid hammering on rapid edits
- On app load: fetch from API, merge with localStorage (API wins if version is higher)
- On 409 conflict: set `syncStatus = 'conflict'`, show reload prompt
- Preserve undo stack locally (undo is client-only, doesn't affect server version)

**Offline behavior:**
- If API unreachable, set `syncStatus = 'offline'`, queue saves
- On reconnect, push queued saves with version check
- Show subtle indicator in UI for sync status

### Phase 3: Seed Data & Migration (3pt)

**Seed script:** One-time call to `POST /api/trips/seed` with china-2026 data.
- Can be a simple curl command or a `make seed-trips` target
- Only writes if tripId doesn't already exist (conditional insert)

**localStorage migration:**
- On first API-backed load, if localStorage has edits that differ from defaults, compare with server version
- If server has no data yet → push localStorage to server via seed endpoint
- If server has data → server wins, localStorage is overwritten
- After migration, localStorage becomes a read-through cache only

**Type additions to `src/lib/types/trip.ts`:**
```typescript
interface TripMeta {
  version: number;
  updatedAt: string;
  updatedBy: string;
  syncStatus: 'synced' | 'saving' | 'conflict' | 'offline' | 'error';
}

interface TripSummary {
  tripId: string;
  name: string;
  startDate: string;
  endDate: string;
  destinations: string[];
  updatedAt: string;
}
```

### Phase 4: Day View UX Cleanup (2pt)

**Modify: `src/lib/components/trip/DayView.svelte`**
- Remove the Add/Copy/Delete action buttons (lines 129-148) — these are confusing in the inline-edit context and dangerous without confirmation UX
- Keep OOO toggle (it's clear and useful)
- Keep the `+ Add day` button that exists in the week view (it already works and has context)
- ExpandableField already supports double-click to edit — this becomes the primary edit interaction
- Add subtle "last synced" indicator below the day nav showing `updatedAt` and `updatedBy`

**Modify: `src/lib/components/trip/ExpandableField.svelte`**
- On save (Enter key), trigger the store's `updateDayField()` which will now auto-sync to API
- Add brief visual feedback (checkmark flash or subtle color change) on successful sync
- Show error state if sync fails

### Phase 5: Sync Status UI (2pt)

**Modify: `src/routes/trip/[id]/+page.svelte`** (or layout)
- Show sync status indicator (small dot or icon in header area):
  - Green/hidden = synced
  - Pulsing = saving
  - Yellow = offline (queued changes)
  - Red = conflict or error
- On conflict: show banner with "Trip updated by {name}. Tap to reload."
- On offline: show subtle "Offline — changes saved locally" banner

## Files to Create
- `src/lib/services/trips.ts` — API client for trip CRUD

## Files to Modify
- `server/db.py` — add trips table, CRUD functions, optimistic locking
- `server/chat_proxy.py` — add trip API endpoints (GET/PUT/POST)
- `src/lib/stores/trips.ts` — add API sync, version tracking, debounce
- `src/lib/types/trip.ts` — add TripMeta, TripSummary
- `src/lib/components/trip/DayView.svelte` — remove Add/Copy/Del buttons, add sync indicator
- `src/lib/components/trip/ExpandableField.svelte` — sync feedback
- `src/routes/trip/[id]/+page.svelte` — sync status UI

## Deployment

No new services needed. After modifying `server/chat_proxy.py` and `server/db.py`:
```bash
# On wabbazzar-ice:
cd /home/wabbazzar/code/heatherandwesley/server
systemctl --user restart hw-chat   # Restarts the FastAPI service, picks up new endpoints
```

The new `/api/trips/*` endpoints are automatically routed through the existing Caddy config at `api.heatherandwesley.com`.

## Out of Scope
- Real-time collaboration (WebSocket push) — overkill for 2 users
- Per-field conflict resolution (last-write-wins at trip level is sufficient)
- Trip creation/deletion via UI (can be added later)
- Booking management via API (bookings are infrequent, can stay manual)
- Separate microservice or AWS Lambda (use existing FastAPI server)

## Testing Strategy

1. **Server unit tests:** Test trip DB functions — CRUD, version conflict, seed idempotency
2. **Integration test:** curl against live endpoints on wabbazzar-ice
3. **E2E test:** Playwright test that:
   - Opens trip page
   - Edits a field via ExpandableField
   - Verifies sync indicator shows "saving" then "synced"
   - Mocks a 409 conflict and verifies conflict banner appears
4. **Manual test:** Edit trip on two devices, verify changes propagate on reload

## Rollout Plan

1. Deploy backend changes (Phase 1) — restart hw-chat service, new endpoints live
2. Seed data (Phase 3) — push china-2026 to SQLite via seed endpoint
3. Deploy store migration (Phase 2) — frontend starts syncing to server
4. Deploy UX cleanup (Phase 4-5) — remove confusing buttons, add sync indicators
