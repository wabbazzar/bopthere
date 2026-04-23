# Ticket 023: Feature - Trip Journal

## Metadata
- **Status**: Not Started
- **Priority**: Medium
- **Effort**: 13 points (Phase 1: 3pt, Phase 2: 5pt, Phase 3: 3pt, Phase 4: 2pt)
- **Created**: 2026-04-23
- **Type**: feature
- **Depends on**: Trip data persistence (ticket 021), chat server infrastructure (complete)

## Problem Statement

After a trip, Wesley and Heather have no structured record of what they actually did, how they felt, or what they skipped from the plan. The app tracks what's *planned* (morning/afternoon/evening fields, bookings, map links) but not what *happened*. Without this ground truth, a future blog export feature would have to assume every planned activity was completed — producing inaccurate narratives.

Travelers need a way to journal each day during or after the trip: record their thoughts, attach photos, and mark which planned activities they actually did. This data must be structured enough that a follow-up blog export can interleave the traveler's voice with itinerary details, photos, and maps to produce a rich trip narrative.

## User Stories

### Primary
As a traveler, I want to write a daily journal entry that captures what I did, how I felt, and what photos I took, so that I have a personal record of each day of the trip.

### Secondary
- As a traveler, I want to check off which planned activities I actually did so the app knows the difference between "planned" and "completed."
- As a traveler, I want to add notes to skipped activities ("we skipped the glass bridge because of rain — did the tea house instead") so the context is preserved.
- As a traveler, I want to attach photos to my journal entry so they're associated with the right day.
- As a traveler, I want the journal to open pre-filled with today's date and location so I don't have to fill out metadata.
- As a traveler, I want to quickly record my mood and the weather so that context is captured without long-form writing.

## Design Decisions

### UI Placement: Journal button in DayView actions bar

The journal button goes in the `.day-actions` bar at the bottom of `DayView.svelte`, next to the existing OOO toggle. This is the right location because:

- **Thumb-reachable on mobile** — bottom placement is the highest-accessibility zone for one-handed use during travel
- **Does not clutter the planning card** — the journal is a separate concern from planning fields
- **Visual indicator** — the icon fills with `var(--accent)` when an entry exists for the current day, shows in `var(--ink-faint)` when empty. At a glance, you can see which days have journal entries.

The icon is a book/pencil SVG (inline, following the existing icon pattern). Label text reads "Journal" beneath the icon, matching the OOO button's text-beneath-icon layout.

### Navigation: Slide-up drawer

Tapping the journal button opens a **slide-up drawer overlay**, not a new route. Rationale:

- **Contextual to the current day** — navigating to a separate page (`/trip/[id]/journal/5`) breaks the mental model of "I'm on Day 5, let me jot something down." The drawer feels like pulling up a notebook while staying on the same page.
- **Preserves day navigation** — the parent DayView still handles left/right swipe between days. A route change would lose that context.
- **Natural dismiss** — close via X button or swipe-down gesture. Matches mobile interaction patterns.
- **No route complexity** — no SSR concerns, no loading states, no `+page.ts` files. The journal store is already loaded.

Drawer specs:
- Height: ~85vh on mobile (scrollable internally)
- Max width: 600px on desktop, centered with backdrop blur
- Animation: slide up from bottom (200ms ease-out)
- Backdrop: `rgba(61, 43, 31, 0.35)` + `backdrop-filter: blur(2px)` (matching `NewTripModal` pattern)
- Z-index: 60 (same layer as modals)

### Data Model: Snapshot-based itinerary checklist

When a journal entry is created for a day, the current values of the travel/morning/afternoon/evening fields are **snapshotted** into checklist items. This snapshot is frozen — if the user later edits the planning fields, the journal retains what was planned at the time of journaling.

This is critical for blog export accuracy: "We had planned to visit the Glass Bridge but it was closed due to weather" requires knowing what was planned vs. what happened. A live reference to the planning fields would lose this distinction.

Each checklist item has an optional `notes` field for "what actually happened instead" — giving the blog export a richer narrative voice.

### Store Architecture: Separate store, todos pattern

Journal entries live in a new `journal.ts` store, not embedded in the trips store. The trips store handles planning data and is already complex (~600 lines with 50+ methods). Journal entries have different access patterns (write-heavy during travel, read-heavy for export) and different sync cadence.

The store follows the exact pattern of `todos.ts`: keyed by tripId, localStorage cache + server sync, 2-second debounced persistence, last-write-wins conflict resolution.

## Technical Requirements

### Phase 1: Types, Store & Server (3pt)

**Add to: `src/lib/types/trip.ts`**

```typescript
export interface ItineraryCheckItem {
  slot: 'travel' | 'morning' | 'afternoon' | 'evening';
  text: string;         // snapshot of planned text at journal creation time
  done: boolean;
  notes?: string;       // "what actually happened" override
}

export interface JournalPhoto {
  id: string;           // UUID
  url: string;          // URL reference (or data URI while offline-queued)
  caption: string;
  timestamp?: string;   // ISO datetime
  slot?: 'travel' | 'morning' | 'afternoon' | 'evening';  // optional time-of-day association
}

export interface JournalEntry {
  dayIndex: number;              // ties to TripDay by position
  date: string;                  // denormalized from TripDay.date
  location: string;              // denormalized from TripDay.location
  body: string;                  // free-text journal (markdown)
  itinerary: ItineraryCheckItem[];
  photos: JournalPhoto[];
  mood?: 'great' | 'good' | 'okay' | 'tough';
  weather?: string;              // free text ("sunny and hot", "rainy all day")
  createdAt: string;             // ISO datetime
  updatedAt: string;             // ISO datetime
}
```

Design notes:
- `dayIndex` is the foreign key (same pattern used throughout the app for day references)
- `date` and `location` are denormalized so journal entries are self-contained for export — no need to join with trip data
- `body` is markdown — the simplest structured format that a blog exporter can render
- `JournalPhoto.slot` enables blog export to interleave photos at the right point in the day's narrative
- `mood` is an enum of 4 values (keeps the picker simple — 4 tappable icons, no text input)

**New file: `src/lib/stores/journal.ts`**

Follow the `todos.ts` pattern exactly:

```typescript
// Store shape
type JournalStore = Record<string, JournalEntry[]>;  // keyed by tripId

// localStorage key: hw-journal-{tripId}
// Metadata key: hw-journal-meta

// Core methods:
init(tripId: string)                    // pull from server, merge with localStorage
getEntry(tripId: string, dayIndex: number): JournalEntry | undefined
createOrHydrate(tripId: string, dayIndex: number, tripDay: TripDay): JournalEntry
  // If no entry exists: create one, snapshot non-empty planning fields as checklist items
  // If entry exists: return as-is (do NOT re-derive itinerary)
updateBody(tripId: string, dayIndex: number, body: string)
toggleItineraryItem(tripId: string, dayIndex: number, itemIndex: number)
updateItineraryNotes(tripId: string, dayIndex: number, itemIndex: number, notes: string)
setMood(tripId: string, dayIndex: number, mood: string)
setWeather(tripId: string, dayIndex: number, weather: string)
addPhoto(tripId: string, dayIndex: number, photo: JournalPhoto)
removePhoto(tripId: string, dayIndex: number, photoId: string)
updatePhotoCaption(tripId: string, dayIndex: number, photoId: string, caption: string)
deleteEntry(tripId: string, dayIndex: number)
```

Itinerary derivation logic (inside `createOrHydrate`):
```
for each slot in ['travel', 'morning', 'afternoon', 'evening']:
  if tripDay[slot] is non-empty:
    push { slot, text: tripDay[slot], done: false }
```

Each non-empty planning field becomes one checkable item. No parsing needed — the slot label provides time-of-day context.

Persistence: same `persistAndSync()` helper as todos — save to localStorage immediately, debounce server push by 2 seconds, LWW on 409.

**Extend: `server/db.py`**

```sql
CREATE TABLE IF NOT EXISTS trip_journal (
    trip_id      TEXT PRIMARY KEY,
    journal_json TEXT NOT NULL DEFAULT '[]',
    updated_at   TEXT NOT NULL
);
```

New functions:
```python
def get_journal(trip_id: str) -> dict | None
    # Returns {trip_id, journal_json, updated_at} or None

def save_journal(trip_id: str, journal_json: str, updated_at: str) -> dict
    # Upsert with LWW: accept if client updated_at >= server updated_at
    # Return 409 with server state if client is older
```

**Extend: `server/chat_proxy.py`**

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/trips/{trip_id}/journal` | Fetch journal entries. Returns `{ tripId, journal: JournalEntry[], updatedAt }`. Auth required. |
| `PUT` | `/api/trips/{trip_id}/journal` | Save journal entries. Body: `{ journal: JournalEntry[], updatedAt }`. LWW semantics. Auth required. |

Follow the exact same auth pattern as the existing todos endpoints.

**Extend: `src/lib/services/trips-api.ts`**

```typescript
export async function fetchJournal(tripId: string): Promise<{ journal: JournalEntry[]; updatedAt: string | null }>
export async function saveJournal(tripId: string, journal: JournalEntry[], updatedAt: string): Promise<{ updatedAt: string }>
```

Same pattern as `fetchTodos`/`saveTodos`.

**Testing requirements:**
- Unit test: `createOrHydrate` correctly snapshots non-empty planning fields
- Unit test: `createOrHydrate` returns existing entry unchanged (no re-derivation)
- Unit test: `toggleItineraryItem` flips `done` boolean
- Server test: GET/PUT journal endpoints with auth
- Server test: LWW conflict returns 409

---

### Phase 2: Journal Drawer UI + Itinerary Checklist (5pt)

**New components in `src/lib/components/journal/`:**

#### `JournalDrawer.svelte` — Drawer container
- Slide-up animation from bottom (200ms ease-out)
- Backdrop with blur (reuse modal pattern from `NewTripModal`)
- Drag handle bar at top for visual affordance
- Header row: "Day N — Location — Date" + close button (X icon)
- Internal scroll for content that exceeds viewport
- Close on backdrop click, X button, or Escape key
- Props: `tripId`, `dayIndex`, `day: TripDay`, `open: boolean`

Layout (top to bottom):
```
[drag handle]
[Day 5 — Shanghai — Wed 05/15]              [X]
─────────────────────────────────────────────
[ItineraryChecklist]
[JournalBody]
```

#### `ItineraryChecklist.svelte` — Checkable planned activities
- Renders `entry.itinerary` items as checkboxes
- Each item shows: checkbox + slot label ("Morning", "Afternoon", etc.) + planned text
- Checked items get strikethrough on the planned text + green checkmark
- Unchecked items show in normal text
- Each item has an expandable "notes" field (click to reveal textarea) for "what actually happened"
- 44px minimum row height for touch targets
- Slot labels use muted color (`var(--ink-muted)`)

#### `JournalBody.svelte` — Free-text writing area
- `<textarea>` with placeholder "Write about your day..."
- Auto-grows with content (no fixed height, min 120px)
- Auto-save: debounced 2 seconds after last keystroke, also on blur
- Monospace or comfortable reading font (follow app typography)
- Full width, generous padding for mobile typing

**Modify: `src/lib/components/trip/DayView.svelte`**
- Import and render `JournalDrawer`
- Add journal button to `.day-actions` bar:
  ```svelte
  <button class="day-action-btn" on:click={() => journalOpen = true}>
    <svg><!-- book/pencil icon --></svg>
    {#if hasJournalEntry}
      <span class="badge badge-accent">Journal</span>
    {:else}
      <span class="text-xs" style="color: var(--ink-faint)">Journal</span>
    {/if}
  </button>
  ```
- Track `journalOpen` state, pass to drawer
- On drawer open: call `journalStore.createOrHydrate(tripId, dayIndex, day)` to ensure entry exists
- On day navigation (prev/next): close drawer if open

**Testing requirements:**
- Playwright: click journal button, verify drawer opens with correct day info
- Playwright: check an itinerary item, close drawer, reopen — verify it's still checked
- Playwright: type in journal body, navigate away, navigate back — verify text persisted
- Playwright: verify drawer closes on X button click
- Playwright: verify drawer closes on Escape key
- Vitest: journal button shows accent badge when entry exists, faint when empty

---

### Phase 3: Photos (3pt)

**New component: `src/lib/components/journal/JournalPhotos.svelte`**

- "Add photo" button that opens a URL input field
- URL input: text field + "Add" button, validates URL format
- Photo grid: 2-column thumbnail grid on mobile, 3-column on desktop
- Each thumbnail:
  - Image preview (object-fit: cover, 1:1 aspect ratio)
  - Editable caption below (click to edit, auto-save)
  - Delete button (trash icon, top-right corner, confirm before delete)
  - Optional slot selector (associate with morning/afternoon/evening/travel)
- Empty state: subtle dashed border with "No photos yet" text

**Modify: `JournalDrawer.svelte`**
- Add `JournalPhotos` section below `JournalBody`
- Section header: "Photos" with count badge

**Testing requirements:**
- Playwright: add a photo URL, verify thumbnail appears
- Playwright: edit photo caption, verify it persists
- Playwright: delete a photo with confirmation, verify it's removed
- Vitest: photo store methods (add, remove, update caption)

---

### Phase 4: Mood, Weather & Polish (2pt)

**New component: `src/lib/components/journal/JournalHeader.svelte`**

Sits at the top of the drawer content, below the day title row:

- **Mood picker**: 4 tappable icons in a horizontal row
  - Great / Good / Okay / Tough
  - Icons: sun/smile/meh/cloud (inline SVG, no emoji — keeps it skinnable)
  - Selected state: filled with `var(--accent)`, others in `var(--ink-faint)`
  - Single-tap toggle (tap again to deselect)
- **Weather input**: small text field with placeholder "Weather..." (e.g., "Sunny and hot", "Rainy all morning")
  - Auto-save on blur

**Modify: `src/lib/components/trip/MiniCalendar.svelte`**
- Add a small dot indicator on days that have journal entries
- Dot color: `var(--accent)` (matches the journal button's "has entry" state)
- Position: below the day number, centered

**Modify: `JournalDrawer.svelte`**
- Add swipe-down-to-dismiss gesture on the drag handle area (touchstart/touchmove/touchend)
- Threshold: 100px downward swipe dismisses the drawer
- Add `JournalHeader` between title row and itinerary checklist

**Testing requirements:**
- Playwright: tap mood icon, verify selection persists after close/reopen
- Playwright: type weather, verify it persists
- Playwright: verify MiniCalendar shows dot for days with journal entries
- Playwright: swipe down on drag handle dismisses drawer (touch simulation)

## Files to Create
- `src/lib/stores/journal.ts` — journal store with localStorage + server sync
- `src/lib/components/journal/JournalDrawer.svelte` — slide-up drawer container
- `src/lib/components/journal/JournalBody.svelte` — free-text textarea with auto-save
- `src/lib/components/journal/ItineraryChecklist.svelte` — checkable planned activities
- `src/lib/components/journal/JournalPhotos.svelte` — photo URL input + thumbnail grid
- `src/lib/components/journal/JournalHeader.svelte` — mood picker + weather input

## Files to Modify
- `src/lib/types/trip.ts` — add JournalEntry, ItineraryCheckItem, JournalPhoto interfaces
- `src/lib/components/trip/DayView.svelte` — add journal button to actions bar, render drawer
- `src/lib/components/trip/MiniCalendar.svelte` — add journal indicator dot
- `src/lib/services/trips-api.ts` — add fetchJournal/saveJournal API functions
- `server/db.py` — add trip_journal table, get_journal/save_journal functions
- `server/chat_proxy.py` — add GET/PUT /api/trips/{trip_id}/journal endpoints

## Deployment

No new services needed. After modifying server files:
```bash
# On wabbazzar-ice:
cd /home/wabbazzar/code/heatherandwesley/server
systemctl --user restart hw-chat
```

New `/api/trips/{trip_id}/journal` endpoints are automatically routed through the existing Caddy config.

## Success Criteria

1. User taps "Journal" on any day → drawer slides up with that day's date/location pre-filled
2. Itinerary checklist shows all non-empty planned activities as checkable items
3. Checking/unchecking items persists across close/reopen and page reload
4. Free-text journal body auto-saves and persists
5. Photos can be added via URL, captioned, and deleted
6. Mood and weather selectors persist
7. MiniCalendar shows dots on days with journal entries
8. All data syncs to server via the existing FastAPI infrastructure
9. Works offline (localStorage cache) and syncs when connectivity returns

## Out of Scope

- **Photo file upload** — Phase 1 uses URL references only. Server-side upload (`POST /api/trips/{trip_id}/journal/photos`) is a separate ticket when needed.
- **Blog export** — this ticket creates the structured data that blog export will consume. The export feature itself is a follow-up ticket.
- **Rich text editor** — the journal body is a plain textarea. Markdown rendering is a blog-export concern, not a writing concern. Users write in plain text; the exporter interprets markdown.
- **Collaborative real-time editing** — overkill for 2 users. LWW sync is sufficient.
- **Per-activity granularity** — the itinerary checklist operates at the slot level (morning/afternoon/evening), not at individual activity level. The planning fields are free-text, not structured activity lists, so slot-level is the natural granularity.
- **AI journal suggestions** — future enhancement. The chat AI could suggest journal prompts or help write summaries, but that's a separate feature.

## Blog Export Implications (Future Reference)

The data model is designed with blog export in mind. A future export feature can:

1. **Iterate journal entries by day** — each entry has `date`, `location`, and `dayIndex`
2. **Include traveler voice** — `body` field provides the narrative in the traveler's own words
3. **Show what was done vs. skipped** — `itinerary` array with `done` booleans and `notes` overrides
4. **Interleave photos** — `JournalPhoto.slot` enables placing photos at the right point in the timeline
5. **Add atmosphere** — `mood` and `weather` fields provide context without requiring the traveler to write about them
6. **Combine with trip data** — bookings, map links, and accommodation from the TripDay complement the journal for a complete narrative

The journal's snapshot-based itinerary design is specifically chosen to support this: the blog can say "We had planned to visit X (morning) but ended up doing Y" because both the plan and the outcome are captured.

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| `dayIndex` breaks if days are added/removed/reordered | `date` is denormalized in the entry — entries are recoverable by date even if indices shift. Consider migrating to date-based keys in a future ticket. |
| Large photo grids slow down the drawer | Lazy-load thumbnails, limit visible grid to 6 with "show all" expansion. URL-only approach means no upload bandwidth concerns. |
| Journal entries accumulate large amounts of text in localStorage | Journal data is per-trip and text compresses well in JSON. A 30-day trip with 500-word entries per day is ~90KB — well within localStorage limits. |
| Users forget to journal during the trip | MiniCalendar dot indicator creates gentle visual pressure. Consider a future "daily reminder" notification feature. |

## Guardian Checklist Updates

After implementation, add to `tests/guardian-checklist.md`:

```markdown
## Journal Feature
- [ ] Journal button visible in DayView actions bar
- [ ] Journal drawer opens on button tap
- [ ] Itinerary checklist renders non-empty planning fields as checkable items
- [ ] Checking items persists after drawer close/reopen
- [ ] Journal body text persists after drawer close/reopen
- [ ] Journal data survives page reload (localStorage persistence)
- [ ] MiniCalendar shows dot indicator on days with journal entries
- [ ] Journal drawer closes on X button, Escape key, and backdrop click
```
