# Ticket 024: Feature - Journal Photo Upload & Block Editor

## Metadata
- **Status**: Not Started
- **Priority**: Medium
- **Effort**: 10 points (Phase 1: 4pt, Phase 2: 3pt, Phase 3: 3pt)
- **Created**: 2026-04-23
- **Type**: feature
- **Depends on**: Trip journal (ticket 023, complete)

## Problem Statement

The journal feature (ticket 023) stores text and photos as separate, disconnected fields. The text body is a plain textarea, and photos are pasted as external URLs into a grid below the text. This creates two problems:

1. **Photos don't flow with the narrative.** A traveler writes about morning at the Great Wall, then afternoon at the Forbidden City, but all photos dump into a grid at the bottom with no relationship to the text they illustrate. A blog export can't interleave photos at the right point in the story.

2. **No device photo upload.** Travelers take photos on their phone during the trip, but the only way to add them is pasting an external URL. There's no way to upload directly from the camera roll to the journal.

The goal is an Apple Notes-style editing experience: a single continuous document where you type text, drop in a photo from your phone, keep typing, and the photo sits naturally between paragraphs.

## User Stories

### Primary
As a traveler, I want to write journal entries where my photos appear inline with my text, so the journal reads like a natural narrative with images at the right moments.

### Secondary
- As a traveler, I want to upload photos directly from my phone's camera roll so I don't have to host images elsewhere and paste URLs.
- As a traveler, I want to see my photo immediately after selecting it, even before it finishes uploading to the server.
- As a traveler on a shared trip, I want to see photos that my travel companion uploaded to the same journal entry.
- As a traveler with spotty connectivity, I want my photos to upload automatically when I'm back online.

## Design Decisions

### Block-Based Data Model

Replace the separate `body: string` + `photos: JournalPhoto[]` with a unified `blocks: JournalBlock[]` array. Each block is either text or a photo, and the array order defines the document flow.

```typescript
export interface JournalTextBlock {
  id: string;
  type: 'text';
  content: string;
}

export interface JournalPhotoBlock {
  id: string;
  type: 'photo';
  photoId: string;       // server filename (uuid.ext)
  caption: string;
  uploadedBy: string;    // username from JWT
}

export type JournalBlock = JournalTextBlock | JournalPhotoBlock;
```

Why blocks instead of a rich-text editor:
- **No new dependencies.** TipTap/ProseMirror add 50KB+ and significant complexity. Blocks use native `<textarea>` elements and `<img>` tags — robust on mobile, simple to implement.
- **Structured for export.** Blog export iterates blocks: text becomes markdown paragraphs, photos become `<figure>` tags. No HTML-to-markdown conversion needed.
- **Predictable behavior.** Mobile browsers handle contenteditable inconsistently. An array of textareas is reliable.

### Apple Notes-Style Seamless Editor

The editor renders blocks as a single vertical column with no visible boundaries:
- **Text blocks**: Borderless, background-transparent auto-growing `<textarea>` elements. Adjacent text blocks look like one continuous writing surface.
- **Photo blocks**: Full-width images with rounded corners and an optional caption below.
- **Insert affordance**: A `+` button appears between blocks and at the document end. Tapping it opens the device file picker (`<input type="file" accept="image/*" capture="environment">`).
- **Split at cursor**: When inserting a photo while the cursor is mid-text, the text block splits into two blocks with the photo between them.
- **Merge on delete**: When a photo block is deleted, the two adjacent text blocks merge back into one.

### Multi-User Photo Storage

Photos are a shared trip resource, not per-user private data. Design:

- **Storage**: `server/data/photos/{trip_id}/{uuid}.{ext}` on wabbazzar-ice disk
- **Metadata table**: New `trip_photos` SQLite table tracks every uploaded photo with uploader identity, file size, and timestamps
- **Access control**: Trip-level — any authenticated user can view all photos for any trip. The journal data itself (blocks array) is already shared via the journal store's server sync.
- **Per-trip quota**: 500MB per trip. Enforced at upload time by summing `size_bytes` from the metadata table. Upload rejected with 413 if quota exceeded.
- **Serving**: HMAC-signed short-lived URLs (same pattern as ticket PDF attachments). 1-hour expiry since photos are viewed frequently.

### Migration from Legacy Format

Existing journal entries have `body: string` + `photos: JournalPhoto[]`. A migration function converts them transparently:

1. If `blocks` array already exists → entry is current, no migration needed
2. Otherwise: `body` → one text block, each `photos[]` item → one photo block appended after
3. Legacy `body` and `photos` fields are removed after migration
4. Migration runs on load (in `journalStore.init()` and `pullFromServer()`)
5. Next auto-save writes the migrated format back to localStorage and server

No server-side migration needed — the server stores journal as opaque JSON.

### Offline Upload Queue

Photos selected while offline get immediate local preview via `URL.createObjectURL()`. The upload queues in IndexedDB and retries on reconnect:

1. Photo selected → create blob URL for instant preview, insert block with `_uploadPending: true`
2. Store file blob in IndexedDB (`pending-photo-uploads` store)
3. Attempt upload → on success, replace blob URL with server `photoId`
4. On failure (offline/error) → show retry indicator on the photo block
5. On reconnect → dequeue and upload pending photos automatically

## Technical Requirements

### Phase 1: Block Data Model + Migration + Block Editor (4pt)

**Add to: `src/lib/types/trip.ts`**

```typescript
export interface JournalTextBlock {
  id: string;
  type: 'text';
  content: string;
}

export interface JournalPhotoBlock {
  id: string;
  type: 'photo';
  photoId: string;       // server filename (uuid.ext) or legacy external URL
  caption: string;
  uploadedBy: string;    // username who uploaded
}

export type JournalBlock = JournalTextBlock | JournalPhotoBlock;
```

Update `JournalEntry` to use `blocks: JournalBlock[]` instead of `body` + `photos`. Keep legacy fields optional for migration detection:
```typescript
export interface JournalEntry {
  dayIndex: number;
  date: string;
  location: string;
  blocks: JournalBlock[];
  body?: string;           // legacy, removed after migration
  photos?: JournalPhoto[]; // legacy, removed after migration
  itinerary: ItineraryCheckItem[];
  mood?: 'great' | 'good' | 'okay' | 'tough';
  weather?: string;
  createdAt: string;
  updatedAt: string;
}
```

**New file: `src/lib/utils/journal-migration.ts`**

```typescript
export function migrateEntry(entry: any): JournalEntry
```

- If `entry.blocks` exists and is an array → return as-is
- Otherwise: build blocks from `body` + `photos`:
  - One text block with `body` content (or empty string)
  - One photo block per `photos[]` item, preserving `id`, `url` (as `photoId`), `caption`
  - Delete `body` and `photos` from the entry
- Always returns a valid `JournalEntry` with `blocks`

**Modify: `src/lib/stores/journal.ts`**

- Wire `migrateEntry()` into `init()` (on localStorage load) and `pullFromServer()` (on server data)
- Replace `updateBody()` with `updateBlockContent(tripId, dayIndex, blockId, content)`
- Replace `addPhoto()`/`removePhoto()`/`updatePhotoCaption()` with:
  - `insertBlock(tripId, dayIndex, afterBlockId, block)` — insert a block after a given block
  - `removeBlock(tripId, dayIndex, blockId)` — remove block, merge adjacent text blocks
  - `updateBlocks(tripId, dayIndex, blocks)` — replace entire blocks array
  - `splitAndInsertPhoto(tripId, dayIndex, textBlockId, cursorPos, photoBlock)` — split text block at cursor, insert photo between halves
- Strip transient fields (`_localObjectUrl`, `_uploadPending`) before persisting to localStorage/server

**New components in `src/lib/components/journal/`:**

**`JournalBlocks.svelte`** — orchestrator replacing JournalBody + JournalPhotos
- Receives `tripId`, `dayIndex`, `blocks`
- Renders blocks via `{#each blocks as block (block.id)}`
- Manages hidden `<input type="file" accept="image/*">` element
- Shows `+` insert buttons between blocks and at the end
- Handles document-level 2s debounced auto-save

**`JournalTextBlock.svelte`** — single auto-growing textarea
- Borderless, transparent background, auto-grow on input
- Placeholder "Write about your day..." only on first empty text block
- Emits content changes to parent on input
- Reports cursor position when photo insert is requested

**`JournalPhotoBlock.svelte`** — image display with caption
- Full-width image with rounded corners, `object-fit: contain`
- Caption input below (click-to-edit, auto-save on blur)
- Upload state: spinner overlay while uploading, retry badge on failure
- Delete button (X) in top-right on hover/tap
- Shows "Uploaded by {username}" subtitle in muted text

**Modify: `JournalDrawer.svelte`**
- Replace `<JournalBody>` + `<JournalPhotos>` with `<JournalBlocks>`
- Pass `blocks` from the entry instead of `body` and `photos`

**Delete: `JournalBody.svelte`, `JournalPhotos.svelte`**
- Replaced entirely by the block components

**Testing requirements:**
- Vitest: `migrateEntry()` handles empty body, body-only, photos-only, body+photos, already-migrated
- Vitest: `splitAndInsertPhoto()` correctly splits text at cursor position
- Vitest: `removeBlock()` merges adjacent text blocks
- Playwright: type text, verify it renders; insert photo URL, verify it appears between text

---

### Phase 2: Server Photo Upload + Serving + Quota (3pt)

**Extend: `server/db.py`**

New table:
```sql
CREATE TABLE IF NOT EXISTS trip_photos (
    photo_id   TEXT PRIMARY KEY,
    trip_id    TEXT NOT NULL,
    filename   TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    uploaded_by TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_trip_photos_trip ON trip_photos(trip_id);
```

New functions:
```python
PHOTOS_DIR = DATA_DIR / "photos"

def photo_path(trip_id: str, name: str) -> Path:
    """Path traversal protection for photos dir (same pattern as ticket_path)."""

def save_photo_meta(photo_id, trip_id, filename, size_bytes, uploaded_by) -> None:
    """Insert photo metadata row."""

def get_trip_photo_usage(trip_id: str) -> int:
    """Return total bytes used by photos for a trip."""

def delete_photo_meta(photo_id: str) -> bool:
    """Delete photo metadata row. Returns True if found."""
```

**Extend: `server/chat_proxy.py`**

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/trips/{trip_id}/photos` | Upload a photo. Multipart form data, field name `photo`. Auth required. Validates image MIME type, 10MB per-file limit, 500MB per-trip quota. Returns `{ photoId, filename }`. |
| `POST` | `/api/trips/{trip_id}/photos/sign` | Get signed URL. Body: `{ name: "uuid.jpg" }`. Auth required. Returns `{ url }` with 1-hour expiry. |
| `GET` | `/api/trips/{trip_id}/photos/{name}` | Serve photo with signed URL params `?exp=X&sig=Y`. No auth required (URL is self-authenticating). Auto-detect `Content-Type` from extension. `Cache-Control: private, max-age=3600`. |

Upload endpoint implementation:
```python
from fastapi import UploadFile, File

MAX_PHOTO_SIZE = 10 * 1024 * 1024       # 10MB per file
MAX_TRIP_PHOTO_QUOTA = 500 * 1024 * 1024 # 500MB per trip
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic"}

@app.post("/api/trips/{trip_id}/photos")
async def upload_photo(trip_id: str, photo: UploadFile = File(...), authorization: str | None = Header(None)):
    user = verify_token(authorization)
    _validate_trip_id(trip_id)

    # Validate content type
    if photo.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(400, "File must be an image (JPEG, PNG, WebP, HEIC)")

    # Read file with size limit
    data = await photo.read()
    if len(data) > MAX_PHOTO_SIZE:
        raise HTTPException(413, "Photo exceeds 10MB limit")

    # Check trip quota
    current_usage = get_trip_photo_usage(trip_id)
    if current_usage + len(data) > MAX_TRIP_PHOTO_QUOTA:
        raise HTTPException(413, f"Trip photo storage full ({current_usage // (1024*1024)}MB / 500MB)")

    # Save file
    ext = photo.filename.rsplit('.', 1)[-1].lower() if '.' in (photo.filename or '') else 'jpg'
    photo_id = str(uuid.uuid4())
    filename = f"{photo_id}.{ext}"
    dest = photo_path(trip_id, filename)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)

    # Record metadata
    save_photo_meta(photo_id, trip_id, filename, len(data), user.get("username", "unknown"))
    return {"photoId": photo_id, "filename": filename}
```

**New file: `src/lib/services/photo-upload.ts`**

```typescript
export async function uploadPhoto(tripId: string, file: File): Promise<{ photoId: string; filename: string }>
export async function getSignedPhotoUrl(tripId: string, filename: string): Promise<string>
```

- `uploadPhoto`: POST multipart form data to `/api/trips/{trip_id}/photos`
- `getSignedPhotoUrl`: POST to `/api/trips/{trip_id}/photos/sign`, returns the full signed URL

**New file: `src/lib/utils/signed-url-cache.ts`**

In-memory cache for signed URLs to avoid re-fetching on every render:
```typescript
const cache = new Map<string, { url: string; expiresAt: number }>();

export async function getPhotoUrl(tripId: string, filename: string): Promise<string>
// Returns cached URL if >5 minutes remaining, otherwise fetches new signed URL
```

**Modify: `JournalPhotoBlock.svelte`**
- Use `getPhotoUrl()` to resolve signed URLs for server-hosted photos
- For legacy URL-based photos (from ticket 023), detect `photoId` starting with `http` and use directly
- Show upload progress/spinner while `_uploadPending` is true

**Modify: `JournalBlocks.svelte`**
- Wire file picker to `uploadPhoto()` service
- On file select: create blob URL for preview, insert photo block, upload async, update block on completion

**Testing requirements:**
- Server: upload valid JPEG, verify file on disk and metadata row
- Server: upload >10MB file, verify 413 rejection
- Server: upload non-image file, verify 400 rejection
- Server: exceed 500MB trip quota, verify 413 rejection
- Server: signed URL generation and verification
- Server: path traversal attempt in trip_id, verify rejection
- Playwright: select photo file, verify preview appears immediately, verify upload completes

---

### Phase 3: Inline Insertion + Offline Queue + Polish (3pt)

**Split-at-cursor photo insertion:**

When the user's cursor is in the middle of a text block and they tap the `+` button:
1. Read the textarea's `selectionStart` position
2. Split `content` at that position into `beforeText` and `afterText`
3. Replace the original text block with: `[textBlock(beforeText), photoBlock, textBlock(afterText)]`
4. Focus moves to the `afterText` textarea after the photo

Implementation in `JournalBlocks.svelte`:
- Track which text block is "active" (last focused textarea)
- `+` button between blocks inserts at that position
- `+` button at document end appends

**Offline upload queue (IndexedDB):**

New file: `src/lib/services/photo-queue.ts`

```typescript
export async function queueUpload(tripId: string, dayIndex: number, blockId: string, file: File): Promise<void>
export async function processQueue(): Promise<void>
export async function retryUpload(blockId: string): Promise<void>
export async function getPendingCount(): Promise<number>
```

- Uses IndexedDB store `pending-photo-uploads` with schema `{ blockId, tripId, dayIndex, blob, createdAt }`
- `processQueue()` called on app init and on `navigator.onLine` event
- Each successful upload updates the journal store's block with the real `photoId`
- Failed uploads show a retry button on the photo block

**Polish:**
- Drag-and-drop: allow dropping image files onto the editor (desktop UX)
- Paste: detect image paste from clipboard, insert as photo block
- Photo block animations: subtle fade-in when a photo finishes uploading
- Empty state: when blocks array is empty, show a single placeholder textarea
- Keyboard flow: pressing Enter at the end of the last text block keeps focus (no new blocks created). Pressing Backspace at the start of an empty text block that follows a photo merges upward.

**Testing requirements:**
- Playwright: insert photo at cursor mid-text, verify text splits correctly
- Playwright: delete photo between text blocks, verify text merges
- Vitest: IndexedDB queue operations (queue, process, retry)
- Playwright: upload photo while offline (simulated), verify retry UI appears

## Files to Create
- `src/lib/utils/journal-migration.ts` — legacy entry migration
- `src/lib/utils/signed-url-cache.ts` — client-side signed URL cache
- `src/lib/services/photo-upload.ts` — upload and signed URL client
- `src/lib/services/photo-queue.ts` — IndexedDB offline upload queue
- `src/lib/components/journal/JournalBlocks.svelte` — block editor orchestrator
- `src/lib/components/journal/JournalTextBlock.svelte` — borderless auto-growing textarea
- `src/lib/components/journal/JournalPhotoBlock.svelte` — image display with caption + upload states

## Files to Modify
- `src/lib/types/trip.ts` — add JournalBlock types, update JournalEntry
- `src/lib/stores/journal.ts` — block-aware mutations, migration wiring, transient field stripping
- `src/lib/components/journal/JournalDrawer.svelte` — swap JournalBody+JournalPhotos for JournalBlocks
- `server/db.py` — trip_photos table, photo_path(), metadata CRUD, quota query
- `server/chat_proxy.py` — photo upload/sign/serve endpoints

## Files to Delete
- `src/lib/components/journal/JournalBody.svelte` — replaced by JournalTextBlock
- `src/lib/components/journal/JournalPhotos.svelte` — replaced by JournalPhotoBlock

## Deployment

After modifying server files:
```bash
# On wabbazzar-ice:
cd /home/wabbazzar/code/heatherandwesley/server
pip install python-multipart  # Required for FastAPI file uploads
systemctl --user restart hw-chat
```

The `server/data/photos/` directory is created automatically on first upload. No manual setup needed.

## Success Criteria

1. Journal editor feels like Apple Notes — continuous document with inline photos
2. User selects a photo from camera roll → it appears immediately as a preview, then uploads to server
3. Multiple users uploading to the same trip's journal works without conflict
4. Existing journal entries with `body` + `photos` auto-migrate to blocks format
5. Photos serve via signed URLs — no auth header needed for `<img>` tags
6. Per-trip 500MB quota prevents storage abuse
7. Offline photo selection shows preview immediately, queues upload for later
8. Deleting a photo block merges the surrounding text blocks seamlessly
9. Blog export can iterate blocks in order to produce narrative + images

## Out of Scope

- **Image optimization/thumbnailing** — serve originals for now. Add server-side resizing later if performance is a concern.
- **Photo reordering via drag** — blocks are ordered by insert position. Reordering is a future enhancement.
- **Photo albums/gallery view** — photos live in the journal document, not in a separate gallery.
- **Video upload** — images only for now.
- **Cross-trip photo sharing** — photos belong to one trip.
- **Blog export feature** — the block structure supports it, but the actual export UI is a separate ticket.

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Large photos slow down the editor | Lazy-load images with `loading="lazy"`. Photos outside viewport don't fetch signed URLs until scrolled into view. |
| HEIC format from iPhones | Accept `image/heic` at the server. Modern browsers render HEIC natively. If not, add server-side conversion later. |
| IndexedDB not available (private browsing) | Fall back to localStorage data URIs for small images, or show "upload when online" message without local preview. |
| Split-at-cursor is tricky on mobile | Start with append-only photo insertion (Phase 2). Add split-at-cursor in Phase 3 after the basics are solid. |
| Signed URL expiry during long editing sessions | Cache refreshes URLs with <5 minutes remaining. If a photo fails to load, auto-refresh its signed URL. |
| Migration corrupts legacy entries | Migration is pure (no side effects). Write thorough unit tests. Keep `body`/`photos` in the migrated entry for one release cycle as backup fields before removing. |

## Guardian Checklist Updates

After implementation, add to `tests/guardian-checklist.md`:

```markdown
## Journal Block Editor
- [ ] Journal drawer shows block editor (not separate textarea + photo grid)
- [ ] Text blocks render as seamless borderless textareas
- [ ] Photo insertion via + button opens file picker
- [ ] Uploaded photo appears inline between text blocks
- [ ] Photo block shows caption input and delete button
- [ ] Deleting a photo block merges adjacent text blocks
- [ ] Legacy journal entries (body + photos) auto-migrate to blocks format
- [ ] Per-trip photo quota enforced (413 on exceed)
- [ ] Signed photo URLs serve images without auth header
```
