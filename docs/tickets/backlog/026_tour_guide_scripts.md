# Ticket 026: Tour Guide Scripts — Chat-Generated Narration with Speechify Integration

## Metadata
- **Status**: Backlog
- **Priority**: Medium
- **Effort**: 13 points (6 phases)
- **Created**: 2026-04-25
- **Type**: feat
- **Impact**: Chat system, DayView, IndexedDB, server DB, new route

## Problem Statement

While sightseeing at the Dazu Rock Carvings (UNESCO World Heritage Site) during the China trip, Wesley had Claude generate narration scripts via Signal, then manually copied them into Speechify for audio playback while walking through the site. This workflow works but is clunky: it requires switching between Signal, a text editor, and Speechify, and the scripts aren't connected to the trip data at all.

The travel app already has a chat with Claude that has full trip context (days, locations, bookings). This feature brings the script workflow into the app natively, so scripts are generated in context, stored per-day, and accessible with one tap for copy or Speechify playback.

### Why Chat-Based Generation (Not a Button)

A day's itinerary is too broad for a useful tour script. The user needs to tell Claude exactly which attraction they're visiting, what highlights to focus on, what tone they want, and how long the narration should be. For example:

- "Write a tour guide script for the Dazu Rock Carvings, focusing on the Thousand-Armed Guanyin and the Wheel of Reincarnation"
- "Give me a walking tour narration for the Leshan Giant Buddha — keep it under 5 minutes"
- "Make it more dramatic and include more Buddhist history"

The existing chat supports this conversational refinement naturally. A button would produce generic, unhelpful content.

## User Stories

### Primary User Story
As Wesley or Heather, I want to ask Claude in the trip chat to write a tour guide narration for a specific attraction, have it saved to that day, and be able to copy it or send it to Speechify with one tap — so I can listen to a personalized audio guide while sightseeing.

### Secondary User Stories
- As a user, I want to see which days have tour scripts via pills/chips in the Notes area, so I can quickly find and re-listen to them.
- As a user, I want multiple scripts per day (one per attraction), each with its own title.
- As a user, I want scripts to persist across sessions and sync to the server, so they're available on any device.
- As a user on mobile, I want a "Copy & Open Speechify" button that copies the text and opens the Speechify app, minimizing friction.

## Technical Requirements

### Phase 1: Data Model & Storage

#### 1.1 TourScript Type

**New file**: `src/lib/types/script.ts`

```typescript
export interface TourScript {
  id: string;           // crypto.randomUUID()
  tripId: string;
  dayIndex: number;
  title: string;        // "Dazu Rock Carvings Tour"
  content: string;      // markdown narration body
  createdAt: string;    // ISO timestamp
  updatedAt: string;    // ISO timestamp
  version?: number;     // OCC for server sync
}
```

#### 1.2 IndexedDB — New `scripts` Store

**File**: `src/lib/stores/db.ts`

- Bump `DB_VERSION` from `1` to `2`
- Add `'scripts'` to the object store creation list
- The existing upgrade handler already checks `database.objectStoreNames.contains()` before creating, so this is safe for existing users
- Key pattern: `${tripId}:${scriptId}` with `{ key, value }` structure (same as journal)

**Multi-tab note**: The existing `onversionchange` handler in `db.ts` closes the connection and resets state when another tab upgrades the DB. This handles the version bump gracefully, but test with multiple tabs open.

#### 1.3 Server DB — New Tables

**File**: `server/db.py`

Add to `ensure_per_entry_tables()`:

```sql
CREATE TABLE IF NOT EXISTS script_entries (
    trip_id    TEXT NOT NULL,
    script_id  TEXT NOT NULL,
    entry_json TEXT NOT NULL,
    version    INTEGER NOT NULL DEFAULT 1,
    deleted    INTEGER NOT NULL DEFAULT 0,
    deleted_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (trip_id, script_id)
);

CREATE TABLE IF NOT EXISTS script_history (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    trip_id     TEXT NOT NULL,
    script_id   TEXT NOT NULL,
    old_json    TEXT,
    new_json    TEXT,
    old_version INTEGER,
    new_version INTEGER NOT NULL,
    change_type TEXT NOT NULL,
    changed_at  TEXT NOT NULL
);
```

Use existing generic helpers: `_get_entries`, `_save_entry`, `_delete_entry`.

### Phase 2: Server Endpoints & Client API

#### 2.1 Server Endpoints

**File**: `server/chat_proxy.py`

Follow the exact same pattern as todo_entries endpoints:

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/trips/{trip_id}/scripts/entries` | List all scripts for trip (exclude tombstoned) |
| `PUT` | `/api/trips/{trip_id}/scripts/entries/{script_id}` | Create or update a script |
| `DELETE` | `/api/trips/{trip_id}/scripts/entries/{script_id}` | Tombstone delete |

Request/response models mirror todo entries: `SaveScriptEntryRequest(entry, version)`, `DeleteVersionRequest(version)`.

#### 2.2 Client API Functions

**File**: `src/lib/services/trips-api.ts`

Add three functions following the journal entry pattern:

- `fetchScriptEntries(tripId: string)` — GET, returns `{ entries: TourScript[] }`
- `saveScriptEntry(tripId: string, scriptId: string, entry: TourScript, version: number)` — PUT, returns `{ ok, version, serverEntry? }`
- `deleteScriptEntry(tripId: string, scriptId: string, version: number)` — DELETE, returns `{ ok, version }`

### Phase 3: Scripts Store

#### 3.1 New Store

**New file**: `src/lib/stores/scripts.ts`

Modeled closely on `src/lib/stores/journal.ts`. Key behaviors:

- **State shape**: `Record<string, TourScript[]>` keyed by tripId
- **`init(tripId)`**: Load all scripts from IndexedDB (keys starting with `${tripId}:`), then pull from server to merge newer versions (server wins on version conflict)
- **`addScript(tripId, script)`**: Insert into memory, persist to IndexedDB key `${tripId}:${script.id}`, push to server immediately
- **`deleteScript(tripId, scriptId)`**: Remove from memory, tombstone on server, delete from IndexedDB
- **`getScriptsForDay(tripId, dayIndex)`**: Filter in-memory array by dayIndex, returns `TourScript[]`
- **No debounce**: Scripts are written once (from chat apply) and rarely edited, so immediate persist + sync is fine

#### 3.2 Init Wiring

**File**: `src/routes/trip/[id]/+page.svelte`

Call `scriptsStore.init(tripId)` in `onMount` alongside `journalStore.init(tripId)`.

### Phase 4: Chat Integration

#### 4.1 Chat Action Type

**File**: `src/lib/types/chat.ts`

```typescript
export interface TourScriptAction {
  dayIndex: number;
  title: string;
  content: string;
}
```

#### 4.2 Block Parsing

**File**: `src/lib/services/chat-actions.ts`

- Add `TOUR_SCRIPT` regex: `` /```TOUR_SCRIPT\s*[\r\n]+([\s\S]*?)```/g ``
- Add `parseTourScripts(content: string): TourScriptAction[]` — validates dayIndex is non-negative number, title and content are non-empty strings
- Add `stripTourScriptBlocks(content: string): string`
- Update `stripAllActionBlocks()` to include `stripTourScriptBlocks`

**Important**: Instruct Claude (in system prompt) to avoid triple backticks inside the `content` JSON field, since the regex stops at the first closing fence.

#### 4.3 Chat Store Wiring

**File**: `src/lib/stores/chat.ts`

- Add to `ChatState`: `pendingTourScripts: Record<string, TourScriptAction[]>`, `appliedTourScripts: Set<string>`
- Add parsing in message receipt flow (same spot where other block types are parsed)
- Add `applyTourScripts(messageId)`:
  - For each pending `TourScriptAction`, create a full `TourScript` with `id: crypto.randomUUID()`, timestamps, tripId from `state.activeTripId`
  - Call `scriptsStore.addScript(tripId, script)` for each
  - Move messageId to applied set
- Add `dismissTourScripts(messageId)` — remove from pending

#### 4.4 System Prompt

**File**: `src/lib/services/chat.ts` in `buildSystemPrompt()`

Append to the action block instructions:

```
TOUR GUIDE SCRIPTS:
When the user asks for a narration script, walking tour script, or audio guide for a specific attraction or site, emit a TOUR_SCRIPT block. The content should be a vivid, engaging narration suitable for text-to-speech, written in second person ("As you approach..."). Include historical context, sensory details, and practical tips woven into the narrative.

\`\`\`TOUR_SCRIPT
{"dayIndex": 7, "title": "Dazu Rock Carvings Tour", "content": "# Dazu Rock Carvings\n\nAs you step through the entrance gate..."}
\`\`\`

Rules:
- dayIndex is 0-based (Day 1 = index 0)
- title: short name for the script (attraction or theme)
- content: markdown narration. Use # headings for sections. Write in second person. Aim for 800-1500 words for a full tour, 300-500 for a single stop.
- You may include multiple TOUR_SCRIPT blocks for different stops on the same day.
- NEVER emit TOUR_SCRIPT unless the user explicitly asks for a narration, audio guide, tour script, or walking tour.
- Do NOT use triple backticks inside the content field.
```

#### 4.5 Chat UI — Action Block Display

**File**: `src/lib/components/chat/ChatMessage.svelte`

New action block section (same pattern as TRIP_UPDATE, MAP_LINKS, etc.):
- Header: "Tour Script: {title}" with "Day {dayIndex + 1}" subtext
- Preview: First ~150 chars of content, truncated with ellipsis
- Apply / Dismiss buttons
- Applied state: "Tour scripts saved" with checkmark

**File**: `src/lib/components/chat/ChatDrawer.svelte`

Pass new props: `pendingTourScripts`, `tourScriptsApplied` from chat store state.

### Phase 5: UI — Script Pills & Full-Page View

#### 5.1 Script Pills Component

**New file**: `src/lib/components/trip/ScriptPills.svelte`

Props: `tripId: string`, `dayIndex: number`

Subscribes to `scriptsStore`, filters scripts for the given day, renders clickable pills:
- Style: `badge badge-accent` base with custom sizing — rounded-full, small text, a microphone or scroll icon prefix
- Each pill links to `/trip/{tripId}/script/{scriptId}`
- Empty state: render nothing (no "No scripts" placeholder)

#### 5.2 DayView Integration

**File**: `src/lib/components/trip/DayView.svelte`

Render `<ScriptPills {tripId} {dayIndex} />` immediately after the Notes `ExpandableField`, inside the `.day-fields.card` container.

#### 5.3 Full-Page Script View

**New route**: `src/routes/trip/[id]/script/[scriptId]/+page.svelte`
**New file**: `src/routes/trip/[id]/script/[scriptId]/+page.ts`

Page layout:
- **Top bar**: Back arrow (links to `/trip/{tripId}`) + script title
- **Context line**: "Day {n} -- {location}" in muted text
- **Body**: Rendered markdown content (full width, comfortable reading typography)
- **Bottom action bar** (sticky on mobile):
  - **Copy** button: `navigator.clipboard.writeText(plainText)` where plainText strips markdown formatting (headings, bold, italic). Shows toast "Copied to clipboard"
  - **Copy & Open Speechify** button: Copies plaintext to clipboard, then `window.open('https://app.speechify.com', '_blank')`. On mobile, this may trigger the Speechify app if installed via universal links.
- **Delete** button (in overflow or at bottom): `confirm()` dialog, then `scriptsStore.deleteScript()`, navigate back

**Markdown rendering**: Check if the existing markdown renderer in `ChatMessage.svelte` can be extracted into a shared utility at `src/lib/utils/markdown.ts`. If it's tightly coupled to the chat component, create a lightweight renderer for the script page (headings, bold, italic, lists, paragraphs).

**SvelteKit routing**: Add `export const prerender = false` in `+page.ts` since this is a dynamic route with `[scriptId]`.

### Phase 6: Testing

#### 6.1 Unit Tests (Vitest)

- `tests/unit/chat-actions-scripts.test.ts`: Test TOUR_SCRIPT regex parsing, multiple blocks, malformed JSON, content with special characters
- `tests/unit/scripts-store.test.ts`: Test addScript, deleteScript, getScriptsForDay filtering, IndexedDB persistence mock

#### 6.2 Integration Tests (Playwright)

- `tests/e2e/tour-scripts.spec.ts`:
  - Navigate to trip, verify no script pills initially
  - Mock a chat response containing a TOUR_SCRIPT block, verify action block appears
  - Apply the script, verify pill appears in DayView
  - Click pill, verify full-page view renders with correct content
  - Test copy button (clipboard API)
  - Test delete flow
  - Reload and verify persistence

#### 6.3 Guardian Checklist Updates

**File**: `tests/guardian-checklist.md`

Add:
- Script pills render in DayView when scripts exist for the active day
- Script full-page view loads and renders markdown content
- Copy button populates clipboard
- Scripts persist across page reload (IndexedDB)

## Architecture Decisions

### Why a new IndexedDB store (not reusing journal)?
Scripts are fundamentally different from journal entries: they're generated by Claude (not user-authored), they're read-only after creation, and they have a different lifecycle (no blocks, no photos, no mood/weather). A separate store keeps the data model clean and avoids complicating the journal migration logic.

### Why not a new journal block type?
Journal blocks are user-editable (contenteditable divs) and support inline photos. Scripts are read-only rendered markdown. Mixing them would require special-casing the block editor to be read-only for script blocks, which adds complexity for no benefit.

### Why pills in Notes (not a separate section)?
Notes is already the "extra info" area of a day. Adding a separate "Tour Scripts" section would add visual weight to every day view, even for days without scripts (which will be most). Pills in Notes keep the UI clean and contextually appropriate.

## File Summary

| File | Change |
|------|--------|
| `src/lib/types/script.ts` | **NEW** — TourScript interface |
| `src/lib/types/chat.ts` | Add TourScriptAction interface |
| `src/lib/stores/db.ts` | Bump DB version to 2, add `scripts` store |
| `src/lib/stores/scripts.ts` | **NEW** — Scripts store (init, add, delete, getForDay) |
| `src/lib/services/chat-actions.ts` | TOUR_SCRIPT parsing, stripping |
| `src/lib/stores/chat.ts` | pendingTourScripts, appliedTourScripts, apply/dismiss methods |
| `src/lib/services/chat.ts` | System prompt update with TOUR_SCRIPT instructions |
| `src/lib/services/trips-api.ts` | fetchScriptEntries, saveScriptEntry, deleteScriptEntry |
| `src/lib/components/chat/ChatMessage.svelte` | Tour script action block UI |
| `src/lib/components/chat/ChatDrawer.svelte` | Pass new props |
| `src/lib/components/trip/ScriptPills.svelte` | **NEW** — Pill component |
| `src/lib/components/trip/DayView.svelte` | Render ScriptPills after Notes |
| `src/routes/trip/[id]/script/[scriptId]/+page.svelte` | **NEW** — Full-page script viewer |
| `src/routes/trip/[id]/script/[scriptId]/+page.ts` | **NEW** — Route config (prerender: false) |
| `src/lib/utils/markdown.ts` | **NEW** (if needed) — Shared markdown renderer |
| `server/db.py` | script_entries + script_history tables |
| `server/chat_proxy.py` | GET/PUT/DELETE script endpoints |
| `tests/unit/chat-actions-scripts.test.ts` | **NEW** — Parsing tests |
| `tests/e2e/tour-scripts.spec.ts` | **NEW** — E2E tests |
| `tests/guardian-checklist.md` | Add script-related guards |

## Verification Checklist

1. Start dev server, open chat on a trip
2. Ask Claude: "Write me a tour guide script for the Dazu Rock Carvings, focusing on the Thousand-Armed Guanyin"
3. Verify TOUR_SCRIPT action block appears in chat with Apply/Dismiss buttons
4. Click Apply — verify pill appears in that day's Notes area in DayView
5. Click pill — verify full-page view opens with rendered markdown
6. Test Copy button — paste into text editor, verify content
7. Test "Copy & Open Speechify" button — clipboard populated + Speechify opens
8. Reload page — verify script persists (IndexedDB)
9. Open on another device — verify script synced via server
10. Test delete from script page — confirm dialog, pill disappears, reload confirms deletion
11. Run `npm test` — all unit tests pass
12. Run `npm run test:e2e` — all integration tests pass
13. Run `npm run check` — no TypeScript errors
