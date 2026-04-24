# Ticket 025: Migrate ALL Client-Side Storage from localStorage to IndexedDB

## Metadata
- **Status**: Complete (all 4 phases implemented, tests passing)
- **Priority**: High
- **Effort**: 18 points (4 phases)
- **Created**: 2026-04-23
- **Type**: refactor
- **Impact**: All stores, auth, UI preferences

## Problem Statement

The H&W Travel app uses `localStorage` for all client-side persistence: auth tokens, trip data, journal entries, todos, UI preferences, and sync metadata. This has already caused **real data loss**: journal entries stored only in localStorage were wiped when the browser cleared storage, and the 2-second debounce on journal sync means data written in the last 2 seconds before page unload is silently dropped.

### Root Causes of Data Loss
1. **localStorage is synchronous and size-limited** (5-10MB). Large journal entries with photo references can silently fail to persist.
2. **The journal store uses a 2000ms debounce** (`SYNC_DEBOUNCE_MS` in `src/lib/stores/journal.ts:16`). If the user types a journal entry and closes the tab within 2 seconds, the `setTimeout` callback never fires and the data never reaches the server.
3. **No transactional guarantees**. A crash mid-write can corrupt the JSON blob in localStorage.
4. **Safari aggressive eviction**. iOS Safari can purge localStorage in low-storage situations without warning.

### What Shredly2 Gets Right (Reference Implementation)
The Shredly2 project at `/home/wabbazzar/code/shredly2/` uses IndexedDB with these patterns:
- **Per-domain DB modules** (`historyDb.ts`, `sessionDb.ts`, `scheduleDb.ts`) each managing a single IndexedDB database
- **Singleton connection** with cached `db` reference and `dbOpenPromise` to prevent multiple simultaneous opens
- **SSR safety** via `const isBrowser = typeof window !== 'undefined' && typeof indexedDB !== 'undefined'`
- **Row-level storage** with UUID keys, version numbers, and soft-delete tombstoning
- **One-time migration** from localStorage with backup and completion flag
- **Connection lifecycle** handling (`onclose`, `onversionchange` for multi-tab)

## User Stories

### Primary User Story
As Wesley or Heather, I want my journal entries, trip edits, and todo changes to be durably persisted the instant I make them, so that closing a tab, switching apps on mobile, or losing connectivity never causes data loss.

### Secondary User Stories
- As a user, I want my auth token to survive browser restarts without relying on localStorage, so Safari's storage eviction doesn't log me out.
- As a user, I want the migration from localStorage to IndexedDB to be invisible -- my existing data should appear exactly as before.
- As a user on a slow connection, I want journal entries to sync to the server immediately (not after a 2-second delay) so nothing is lost if I close the tab.

## Technical Requirements

### Functional Requirements
1. **Zero localStorage usage after migration.** Every `localStorage.getItem`, `localStorage.setItem`, and `localStorage.removeItem` call in `src/` must be replaced with IndexedDB equivalents.
2. **Journal entries sync immediately to the server** -- no debounce. The server is the source of truth; IndexedDB is the local cache.
3. **One-time migration** reads all existing localStorage keys, writes them to IndexedDB, then clears the old keys. A completion flag prevents re-migration.
4. **Auth tokens** must load synchronously-enough that the app doesn't flash a login screen. Use a cached in-memory value hydrated from IndexedDB on first load.
5. **Offline resilience**: all stores continue to work offline using IndexedDB as the local cache, syncing to server when connectivity returns.

### Non-Functional Requirements
1. Performance: IndexedDB reads for initial page render must complete within 100ms (auth token, last-path, trip data).
2. No new dependencies: use raw IndexedDB API following Shredly2 patterns (no `idb`, `dexie`, etc.).
3. All existing Vitest and Playwright tests must continue to pass (with updated storage mocks).
4. Mobile Safari compatibility: IndexedDB works in all modern browsers including iOS Safari 15+.

## Complete localStorage Inventory

Every localStorage key currently used, the file that uses it, and its migration tier:

| Key Pattern | File(s) | Data Type | Tier | Migration Strategy |
|---|---|---|---|---|
| `hw-auth-token` | `src/lib/services/auth.ts` | string (JWT) | Auth | `hw-db` / `auth` store |
| `hw-auth-user` | `src/lib/services/auth.ts` | JSON (User obj) | Auth | `hw-db` / `auth` store |
| `hw-journal-{tripId}` | `src/lib/stores/journal.ts` | JSON (JournalEntry[]) | Tier 1 | `hw-db` / `journal` store, immediate sync |
| `hw-journal-meta` | `src/lib/stores/journal.ts` | JSON (Record<string,string>) | Tier 1 | `hw-db` / `meta` store |
| `hw-trips` | `src/lib/stores/trips.ts` | JSON (Record<string,Trip>) | Tier 1 | `hw-db` / `trips` store |
| `hw-trips-meta` | `src/lib/stores/trips.ts` | JSON (Record<string,string>) | Tier 1 | `hw-db` / `meta` store |
| `hw-trips-sync-pending` | `src/lib/stores/trips.ts` | CSV string | Tier 1 | `hw-db` / `meta` store |
| `hw-trip-todos-{tripId}` | `src/lib/stores/todos.ts` | JSON (Todo[]) | Tier 2 | `hw-db` / `todos` store |
| `hw-todos-meta` | `src/lib/stores/todos.ts` | JSON (Record<string,string>) | Tier 2 | `hw-db` / `meta` store |
| `hw-todos-schema-version` | `src/lib/stores/todos.ts` | string ("2") | Tier 2 | `hw-db` / `meta` store |
| `hw-last-path` | `src/routes/+layout.svelte`, `src/routes/+page.svelte` | string (URL path) | Prefs | `hw-db` / `prefs` store |
| `hw-trip-day-{tripId}` | `src/routes/trip/[id]/+page.svelte` | string (number) | Prefs | `hw-db` / `prefs` store |
| `hw-trip-view-{tripId}` | `src/lib/components/trip/ViewToggle.svelte` | string ("week"/"day") | Prefs | `hw-db` / `prefs` store |

## Implementation Plan

### Phase 1: IndexedDB Foundation Layer (5 points)

**Goal**: Create the core IndexedDB wrapper module (`src/lib/stores/db.ts`) and the localStorage-to-IndexedDB migration logic. No stores are changed yet -- this phase only builds the infrastructure.

**Files to create:**
- `src/lib/stores/db.ts` -- single IndexedDB database with multiple object stores

**Files to modify:**
- None yet (stores unchanged in this phase)

**IndexedDB Schema Design:**

A single database `hw-travel` (version 1) with these object stores:

```typescript
// src/lib/stores/db.ts

const DB_NAME = 'hw-travel';
const DB_VERSION = 1;

// Object stores created in onupgradeneeded:
// 1. 'auth'     - keyPath: 'key' (stores 'token' and 'user' rows)
// 2. 'trips'    - keyPath: 'id'  (one row per trip, value is Trip JSON)
// 3. 'journal'  - keyPath: 'key' (compound key: `${tripId}` maps to JournalEntry[])
// 4. 'todos'    - keyPath: 'key' (compound key: `${tripId}` maps to Todo[])
// 5. 'meta'     - keyPath: 'key' (arbitrary key-value pairs for sync timestamps, schema versions)
// 6. 'prefs'    - keyPath: 'key' (UI preferences: last-path, day index, view mode)
```

**Component Structure:**

```typescript
// src/lib/stores/db.ts

const DB_NAME = 'hw-travel';
const DB_VERSION = 1;

const isBrowser = typeof window !== 'undefined' && typeof indexedDB !== 'undefined';

let db: IDBDatabase | null = null;
let dbOpenPromise: Promise<IDBDatabase | null> | null = null;

/**
 * Open the hw-travel IndexedDB database. Singleton pattern -- returns
 * cached connection if already open. Safe to call during SSR (returns null).
 *
 * Follows Shredly2 historyDb.ts pattern exactly.
 */
export async function openDatabase(): Promise<IDBDatabase | null> {
  if (!isBrowser) return null;
  if (db) return db;
  if (dbOpenPromise) return dbOpenPromise;

  dbOpenPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('[HW-DB] Failed to open database:', request.error);
      dbOpenPromise = null;
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;

      db.onclose = () => {
        console.log('[HW-DB] Database connection closed');
        db = null;
        dbOpenPromise = null;
      };

      db.onversionchange = () => {
        console.log('[HW-DB] Version change detected, closing');
        db?.close();
        db = null;
        dbOpenPromise = null;
      };

      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      if (!database.objectStoreNames.contains('auth')) {
        database.createObjectStore('auth', { keyPath: 'key' });
      }
      if (!database.objectStoreNames.contains('trips')) {
        database.createObjectStore('trips', { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains('journal')) {
        database.createObjectStore('journal', { keyPath: 'key' });
      }
      if (!database.objectStoreNames.contains('todos')) {
        database.createObjectStore('todos', { keyPath: 'key' });
      }
      if (!database.objectStoreNames.contains('meta')) {
        database.createObjectStore('meta', { keyPath: 'key' });
      }
      if (!database.objectStoreNames.contains('prefs')) {
        database.createObjectStore('prefs', { keyPath: 'key' });
      }
    };
  });

  return dbOpenPromise;
}

// ── Generic CRUD helpers ──────────────────────────────────────

export async function dbGet<T>(storeName: string, key: string): Promise<T | undefined> {
  const database = await openDatabase();
  if (!database) return undefined;

  return new Promise((resolve, reject) => {
    const tx = database.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result?.value as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function dbPut(storeName: string, key: string, value: unknown): Promise<void> {
  const database = await openDatabase();
  if (!database) return;

  return new Promise((resolve, reject) => {
    const tx = database.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put({ key, value });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function dbDelete(storeName: string, key: string): Promise<void> {
  const database = await openDatabase();
  if (!database) return;

  return new Promise((resolve, reject) => {
    const tx = database.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function dbGetAll<T>(storeName: string): Promise<Array<{ key: string; value: T }>> {
  const database = await openDatabase();
  if (!database) return [];

  return new Promise((resolve, reject) => {
    const tx = database.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror = () => reject(req.error);
  });
}

export async function dbClearStore(storeName: string): Promise<void> {
  const database = await openDatabase();
  if (!database) return;

  return new Promise((resolve, reject) => {
    const tx = database.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    dbOpenPromise = null;
  }
}
```

**Migration Module:**

```typescript
// src/lib/stores/db-migration.ts

import { openDatabase } from './db';

const MIGRATION_KEY = 'hw-idb-migration-complete';

/**
 * One-time migration of ALL localStorage data to IndexedDB.
 * Reads every known key, writes to the appropriate object store,
 * then removes the localStorage entries.
 *
 * A flag in localStorage itself (`hw-idb-migration-complete`) prevents
 * re-running. After migration, that's the ONLY localStorage key remaining.
 */
export async function migrateLocalStorageToIndexedDB(): Promise<{
  migrated: boolean;
  keysProcessed: number;
  message: string;
}> {
  if (typeof localStorage === 'undefined') {
    return { migrated: false, keysProcessed: 0, message: 'Not in browser' };
  }

  if (localStorage.getItem(MIGRATION_KEY) === 'true') {
    return { migrated: false, keysProcessed: 0, message: 'Already migrated' };
  }

  const database = await openDatabase();
  if (!database) {
    return { migrated: false, keysProcessed: 0, message: 'IndexedDB unavailable' };
  }

  let keysProcessed = 0;

  try {
    // ── Auth ──
    const token = localStorage.getItem('hw-auth-token');
    const userRaw = localStorage.getItem('hw-auth-user');
    if (token) {
      await putRow(database, 'auth', 'token', token);
      keysProcessed++;
    }
    if (userRaw) {
      await putRow(database, 'auth', 'user', JSON.parse(userRaw));
      keysProcessed++;
    }

    // ── Trips ──
    const tripsRaw = localStorage.getItem('hw-trips');
    if (tripsRaw) {
      const trips = JSON.parse(tripsRaw) as Record<string, unknown>;
      for (const [tripId, trip] of Object.entries(trips)) {
        await putRow(database, 'trips', tripId, trip);
      }
      keysProcessed++;
    }

    // ── Trip meta ──
    for (const metaKey of ['hw-trips-meta', 'hw-journal-meta', 'hw-todos-meta']) {
      const raw = localStorage.getItem(metaKey);
      if (raw) {
        await putRow(database, 'meta', metaKey, JSON.parse(raw));
        keysProcessed++;
      }
    }

    // ── Sync pending ──
    const syncPending = localStorage.getItem('hw-trips-sync-pending');
    if (syncPending) {
      await putRow(database, 'meta', 'hw-trips-sync-pending', syncPending);
      keysProcessed++;
    }

    // ── Schema version ──
    const schemaVersion = localStorage.getItem('hw-todos-schema-version');
    if (schemaVersion) {
      await putRow(database, 'meta', 'hw-todos-schema-version', schemaVersion);
      keysProcessed++;
    }

    // ── Journal entries (per-trip) ──
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('hw-journal-') && k !== 'hw-journal-meta') {
        const tripId = k.replace('hw-journal-', '');
        const raw = localStorage.getItem(k);
        if (raw) {
          await putRow(database, 'journal', tripId, JSON.parse(raw));
          keysProcessed++;
        }
      }
    }

    // ── Todos (per-trip) ──
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('hw-trip-todos-')) {
        const tripId = k.replace('hw-trip-todos-', '');
        const raw = localStorage.getItem(k);
        if (raw) {
          await putRow(database, 'todos', tripId, JSON.parse(raw));
          keysProcessed++;
        }
      }
    }

    // ── UI Preferences ──
    const lastPath = localStorage.getItem('hw-last-path');
    if (lastPath) {
      await putRow(database, 'prefs', 'hw-last-path', lastPath);
      keysProcessed++;
    }

    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('hw-trip-day-') || k.startsWith('hw-trip-view-'))) {
        const raw = localStorage.getItem(k);
        if (raw) {
          await putRow(database, 'prefs', k, raw);
          keysProcessed++;
        }
      }
    }

    // ── Clean up localStorage ──
    const allKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('hw-')) allKeys.push(k);
    }
    for (const k of allKeys) {
      localStorage.removeItem(k);
    }

    // Mark migration complete
    localStorage.setItem(MIGRATION_KEY, 'true');

    console.log(`[HW-DB] Migration complete: ${keysProcessed} keys processed`);
    return { migrated: true, keysProcessed, message: `Migrated ${keysProcessed} keys` };
  } catch (e) {
    console.error('[HW-DB] Migration failed:', e);
    return {
      migrated: false,
      keysProcessed,
      message: `Migration failed: ${e instanceof Error ? e.message : 'Unknown error'}`
    };
  }
}

function putRow(database: IDBDatabase, storeName: string, key: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = database.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put({ key, value });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
```

**Implementation steps:**
1. Create `src/lib/stores/db.ts` with the full IndexedDB wrapper (openDatabase, dbGet, dbPut, dbDelete, dbGetAll, dbClearStore, closeDatabase).
2. Create `src/lib/stores/db-migration.ts` with the one-time migration function.
3. Write Vitest unit tests for `db.ts` (use `fake-indexeddb` npm package for testing).
4. Write Vitest unit tests for `db-migration.ts` migration logic.
5. Verify build: `npm run build && npm run check`.

**Testing:**
```bash
# Install fake-indexeddb for Vitest tests
npm install -D fake-indexeddb

# Unit tests for db.ts
# tests/unit/db.test.ts
# - Test openDatabase returns a database
# - Test dbPut + dbGet roundtrip
# - Test dbDelete removes entries
# - Test dbGetAll returns all entries
# - Test SSR safety (returns null/undefined when indexedDB unavailable)

# Unit tests for db-migration.ts
# tests/unit/db-migration.test.ts
# - Test migration reads localStorage and writes to IndexedDB
# - Test migration is idempotent (second call is no-op)
# - Test migration cleans up localStorage keys
# - Test migration handles empty localStorage
# - Test migration handles malformed JSON gracefully
```

**Use specialized agents:**
```bash
claude "Use the code-writer agent to implement src/lib/stores/db.ts and src/lib/stores/db-migration.ts following Phase 1 specifications from ticket 025"

claude "Use the code-quality-assessor agent to review src/lib/stores/db.ts and src/lib/stores/db-migration.ts for IndexedDB best practices, error handling, and SSR safety"

claude "Use the test-writer agent to create unit tests for src/lib/stores/db.ts and src/lib/stores/db-migration.ts using fake-indexeddb"

claude "Use the test-critic agent to review tests for src/lib/stores/db.ts edge cases: concurrent opens, connection drops, quota exceeded errors"
```

**Build Verification:**
```bash
npm run build
npm run check
npm test
```

**Commit**: `feat(stores): add IndexedDB foundation layer and migration module`

---

### Phase 2: Auth Service Migration (4 points)

**Goal**: Migrate `src/lib/services/auth.ts` from localStorage to IndexedDB. This is the most latency-sensitive migration because auth state must be available before the first render to avoid a login-screen flash.

**The Synchronous Auth Problem:**

The current auth flow calls `localStorage.getItem('hw-auth-token')` synchronously in `auth.init()` to immediately set `isAuthenticated: true` and avoid a loading screen. IndexedDB is async, which creates a chicken-and-egg problem.

**Solution**: Use an in-memory cache that is hydrated from IndexedDB during app initialization, before any route renders. The `+layout.svelte` already calls `auth.init()` in `onMount`. We make `auth.init()` await the IndexedDB read, and during that brief async window, show the existing loading screen (`isLoading: true`).

**Files to modify:**
- `src/lib/services/auth.ts` -- replace all localStorage calls with IndexedDB
- `src/lib/stores/auth.ts` -- make `init()` await the async token load
- `src/routes/+layout.svelte` -- run migration on app start, before auth init
- `src/routes/+page.svelte` -- replace `localStorage.getItem(LAST_PATH_KEY)` with IndexedDB

**Implementation details for `src/lib/services/auth.ts`:**

```typescript
// src/lib/services/auth.ts -- after migration

import { PUBLIC_API_GATEWAY_URL } from '$env/static/public';
import type { LoginResponse, User } from '$lib/types/auth';
import { dbGet, dbPut, dbDelete } from '$lib/stores/db';

const API_URL = PUBLIC_API_GATEWAY_URL;

// In-memory cache for synchronous access after initial hydration
let cachedToken: string | null = null;
let cachedUser: User | null = null;

export async function hydrateAuth(): Promise<void> {
  cachedToken = (await dbGet<string>('auth', 'token')) ?? null;
  cachedUser = (await dbGet<User>('auth', 'user')) ?? null;
}

export function getToken(): string | null {
  return cachedToken;
}

export function getStoredUser(): User | null {
  return cachedUser;
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Login failed' }));
    throw new Error(err.message || 'Login failed');
  }

  const data: LoginResponse = await res.json();
  await saveAuth(data.token, data.user);
  return data;
}

export async function verifyToken(): Promise<User | null> {
  const token = getToken();
  if (!token) return null;
  // ... (same fetch logic, unchanged)
}

export async function refreshToken(): Promise<LoginResponse | null> {
  // ... (same fetch logic, call saveAuth on success)
}

export async function logout(): Promise<void> {
  await clearAuth();
}

async function saveAuth(token: string, user: User): Promise<void> {
  cachedToken = token;
  cachedUser = user;
  await dbPut('auth', 'token', token);
  await dbPut('auth', 'user', user);
}

async function clearAuth(): Promise<void> {
  cachedToken = null;
  cachedUser = null;
  await dbDelete('auth', 'token');
  await dbDelete('auth', 'user');
}
```

**Changes to `src/lib/stores/auth.ts`:**

```typescript
// auth.init() becomes async and awaits hydration
async init() {
  // Hydrate the in-memory cache from IndexedDB
  await authService.hydrateAuth();

  const storedUser = authService.getStoredUser();
  const token = authService.getToken();

  if (storedUser && token) {
    set({ user: storedUser, token, isAuthenticated: true, isLoading: false });
    // Background verify (unchanged)
    authService.verifyToken().then((verified) => {
      if (verified) {
        update((s) => ({ ...s, user: verified }));
      } else {
        set({ user: null, token: null, isAuthenticated: false, isLoading: false });
      }
    });
  } else {
    set({ ...initialState, isLoading: false });
  }
},

// logout becomes async
async logout() {
  await authService.logout();
  set({ user: null, token: null, isAuthenticated: false, isLoading: false });
}
```

**Changes to `src/routes/+layout.svelte`:**

```svelte
<script lang="ts">
  import { migrateLocalStorageToIndexedDB } from '$lib/stores/db-migration';

  onMount(async () => {
    // Run migration FIRST (no-op if already done)
    await migrateLocalStorageToIndexedDB();
    // Then init auth from IndexedDB
    await auth.init();
  });

  // Replace localStorage.setItem for last-path with IndexedDB
  $: if ($isAuthenticated && $page.url.pathname !== '/') {
    import('$lib/stores/db').then(({ dbPut }) => {
      dbPut('prefs', 'hw-last-path', $page.url.pathname);
    });
  }
</script>
```

**Changes to `src/routes/+page.svelte`:**

```svelte
<script lang="ts">
  import { dbGet } from '$lib/stores/db';

  async function getResumePath(): Promise<string> {
    const saved = await dbGet<string>('prefs', 'hw-last-path');
    return saved && saved !== '/' ? saved : '/dashboard';
  }

  $: if (!$isLoading && $isAuthenticated) {
    getResumePath().then((path) => goto(path));
  }
</script>
```

**Implementation steps:**
1. Modify `src/lib/services/auth.ts`: replace all localStorage with IndexedDB via `db.ts` helpers, add `hydrateAuth()`.
2. Modify `src/lib/stores/auth.ts`: make `init()` async, call `hydrateAuth()` before reading cached values. Make `logout()` async.
3. Modify `src/routes/+layout.svelte`: call `migrateLocalStorageToIndexedDB()` before `auth.init()`. Replace `localStorage.setItem` for last-path.
4. Modify `src/routes/+page.svelte`: replace `localStorage.getItem(LAST_PATH_KEY)` with async `dbGet`.
5. Update any tests that mock localStorage for auth.
6. Verify the login flow works: login, refresh page (should not flash login screen), logout, verify token cleared from IndexedDB.

**Critical behavior to preserve:**
- The loading screen (`isLoading: true`) shows while auth hydrates from IndexedDB (typically <50ms).
- After hydration, if token exists, user sees the app immediately -- background verify runs in parallel.
- If IndexedDB is somehow unavailable (private browsing fallback), auth still works via the in-memory cache for the session.

**Testing:**
```bash
# Playwright E2E tests
# tests/e2e/auth-indexeddb.spec.ts
# - Login, verify token is in IndexedDB (not localStorage)
# - Refresh page, verify no login-screen flash
# - Logout, verify IndexedDB auth store is cleared
# - Verify last-path persistence through IndexedDB
```

**Use specialized agents:**
```bash
claude "Use the code-writer agent to migrate src/lib/services/auth.ts and src/lib/stores/auth.ts from localStorage to IndexedDB following Phase 2 specifications from ticket 025"

claude "Use the code-quality-assessor agent to review auth migration for race conditions, SSR safety, and the synchronous-to-async transition"

claude "Use the test-writer agent to create Playwright E2E tests for auth persistence via IndexedDB in tests/e2e/auth-indexeddb.spec.ts"
```

**Build Verification:**
```bash
npm run build
npm run check
npm test
npm run test:e2e
```

**Commit**: `refactor(auth): migrate auth storage from localStorage to IndexedDB`

---

### Phase 3: Journal + Trips + Todos Store Migration (5 points)

**Goal**: Migrate the three data stores (`journal.ts`, `trips.ts`, `todos.ts`) from localStorage to IndexedDB. **Critically, remove the 2-second debounce from journal sync** -- journal entries must push to the server immediately on every change.

**Files to modify:**
- `src/lib/stores/journal.ts` -- replace all localStorage, remove debounce, sync immediately
- `src/lib/stores/trips.ts` -- replace all localStorage with IndexedDB
- `src/lib/stores/todos.ts` -- replace all localStorage with IndexedDB
- `src/routes/trip/[id]/+page.svelte` -- replace `localStorage` for day index

**Journal Store Critical Changes (`src/lib/stores/journal.ts`):**

The journal store is the highest-priority migration because it has already lost data.

**Key changes:**
1. Replace `loadLocal()` / `saveLocal()` with `dbGet()` / `dbPut()` from `db.ts`.
2. **Remove the 2000ms debounce entirely.** Replace `scheduleSync()` with immediate `pushToServer()`.
3. Add a `beforeunload` handler that fires any in-flight sync (belt-and-suspenders).
4. Keep the `pullFromServer()` logic for initial hydration.

```typescript
// BEFORE (data-loss prone):
function persistAndSync(tripId: string, next: JournalEntry[]) {
  saveLocal(tripId, next);                    // localStorage
  setMeta(tripId, new Date().toISOString());  // localStorage
  scheduleSync(tripId);                       // 2000ms debounce
}

// AFTER (immediate sync, IndexedDB cache):
async function persistAndSync(tripId: string, next: JournalEntry[]) {
  const now = new Date().toISOString();
  await dbPut('journal', tripId, stripAllTransient(next));
  await dbPut('meta', `hw-journal-meta-${tripId}`, now);
  // Sync immediately -- no debounce. Fire-and-forget but catch errors.
  pushToServer(tripId).catch(() => {
    // Mark pending for retry on reconnect
    markSyncPending('journal', tripId);
  });
}
```

**Why removing the debounce is safe**: The server already handles LWW (last-writer-wins) via the `updatedAt` timestamp. Rapid sequential POSTs are fine -- the server just accepts the latest. The debounce was only there to reduce network traffic, but the cost of that optimization is potential data loss. For a 2-person app, the network traffic is negligible.

**For trips and todos stores**, the 2-second debounce is acceptable to keep because:
- Trip day edits are less critical than journal entries
- Todos are simple text items easily re-created
- But they still move from localStorage to IndexedDB

**Trips Store Changes (`src/lib/stores/trips.ts`):**

```typescript
// Replace these functions:
// loadTrips() -- use dbGetAll('trips') instead of localStorage
// saveTrips() -- use multiple dbPut('trips', tripId, trip) calls
// loadMeta() -- use dbGet('meta', 'hw-trips-meta')
// saveMetaField() -- use dbGet + dbPut on 'meta'
// markSyncPending() -- use dbGet + dbPut on 'meta'
// clearSyncPending() -- use dbGet + dbPut on 'meta'
// removeTrip() -- use dbDelete('trips', id) + clean up meta

// loadTrips becomes async:
async function loadTrips(): Promise<Record<string, Trip>> {
  if (!isBrowser) return normalizeTrips(cloneDefaults());
  const rows = await dbGetAll<Trip>('trips');
  if (rows.length === 0) return normalizeTrips(cloneDefaults());
  const trips: Record<string, Trip> = {};
  for (const row of rows) {
    trips[row.key] = row.value;
  }
  return normalizeTrips({ ...cloneDefaults(), ...trips });
}
```

**Todos Store Changes (`src/lib/stores/todos.ts`):**

```typescript
// Same pattern as trips:
// loadLocal(tripId) -> dbGet('todos', tripId)
// saveLocal(tripId, todos) -> dbPut('todos', tripId, todos)
// loadMeta() -> dbGet('meta', 'hw-todos-meta')
// setMeta() -> dbGet + dbPut on 'meta'
// migrateSchema() -- still needed but uses dbGet/dbPut for the version check
```

**Trip Page Day Index (`src/routes/trip/[id]/+page.svelte`):**

```svelte
<!-- Replace localStorage for day persistence -->
<script>
  import { dbGet, dbPut } from '$lib/stores/db';

  onMount(async () => {
    trips.init();
    journalStore.init(tripId);
    initPhotoQueue();
    const saved = await dbGet<string>('prefs', `hw-trip-day-${tripId}`);
    if (saved !== undefined) {
      const idx = parseInt(saved, 10);
      const maxIdx = (trip?.days?.length ?? 1) - 1;
      if (!isNaN(idx) && idx >= 0) currentDayIndex = Math.min(idx, maxIdx);
    }
  });

  // Reactive day index persistence
  $: if (tripId && isBrowser) {
    dbPut('prefs', `hw-trip-day-${tripId}`, String(currentDayIndex));
  }
</script>
```

**Important: Making stores async-aware**

The biggest challenge is that the current store pattern uses synchronous `loadLocal()` in the store constructor (e.g., `writable<Record<string, Trip>>(loadTrips())`). With IndexedDB, loading is async. The solution:

1. Initialize stores with empty/default state.
2. Add an async `init()` method that reads from IndexedDB and updates the store.
3. All `init()` methods are already called from `onMount` in the routes, so the async flow fits naturally.
4. The `saveLocal()` calls within mutation methods become `dbPut()` calls that fire-and-forget (the in-memory Svelte store is the immediate source of truth for the UI; IndexedDB is the durable cache).

**Implementation steps:**
1. Modify `src/lib/stores/journal.ts`:
   - Replace `loadLocal()` with async `dbGet('journal', tripId)`.
   - Replace `saveLocal()` with `dbPut('journal', tripId, entries)`.
   - Replace `loadMeta()` / `setMeta()` with `dbGet` / `dbPut` on `'meta'` store.
   - **Remove `SYNC_DEBOUNCE_MS`, `syncTimers`, and `scheduleSync()`**. Call `pushToServer()` directly in `persistAndSync()`.
   - Add `beforeunload` listener for in-flight syncs.
2. Modify `src/lib/stores/trips.ts`:
   - Make `loadTrips()` async, reading from IndexedDB.
   - Replace `saveTrips()` with per-trip `dbPut('trips', tripId, trip)`.
   - Replace all meta/sync-pending localStorage calls with IndexedDB equivalents.
   - Keep the 2-second debounce for trip sync (acceptable for non-journal data).
3. Modify `src/lib/stores/todos.ts`:
   - Same pattern as trips: async load, IndexedDB persistence.
   - Keep the 2-second debounce for todo sync.
4. Modify `src/routes/trip/[id]/+page.svelte`: replace day-index localStorage with `dbGet`/`dbPut` on `'prefs'` store.
5. Run all existing tests -- update any that mock localStorage.

**Testing:**
```bash
# Vitest unit tests
# tests/unit/journal-store.test.ts
# - Verify no debounce: mutation triggers immediate pushToServer call
# - Verify IndexedDB persistence roundtrip
# - Verify pullFromServer hydration

# tests/unit/trips-store.test.ts
# - Verify trip data loads from IndexedDB
# - Verify mutations persist to IndexedDB
# - Verify sync-pending survives store recreation

# Playwright E2E
# tests/e2e/journal-persistence.spec.ts
# - Type journal text, immediately close tab, reopen -- text should be present
# - Verify no localStorage keys remain after journal operations
```

**Use specialized agents:**
```bash
claude "Use the code-writer agent to migrate src/lib/stores/journal.ts, src/lib/stores/trips.ts, and src/lib/stores/todos.ts from localStorage to IndexedDB following Phase 3 specifications from ticket 025. CRITICAL: Remove the 2-second debounce from journal sync -- journal must sync immediately."

claude "Use the code-quality-assessor agent to review the journal store migration, specifically verifying: (1) no debounce remains, (2) pushToServer is called on every mutation, (3) IndexedDB writes are fire-and-forget for UI responsiveness"

claude "Use the test-writer agent to create tests verifying journal immediate-sync behavior and IndexedDB persistence for all three stores"

claude "Use the test-critic agent to verify test coverage includes: page-unload data safety, offline queueing, concurrent edit scenarios"
```

**Build Verification:**
```bash
npm run build
npm run check
npm test
npm run test:e2e
```

**Commit**: `refactor(stores): migrate journal/trips/todos to IndexedDB, remove journal sync debounce`

---

### Phase 4: UI Preferences Migration + localStorage Cleanup + Verification (4 points)

**Goal**: Migrate the remaining UI preference localStorage calls (`ViewToggle.svelte`), add a global verification that zero localStorage keys exist, and update all test infrastructure.

**Files to modify:**
- `src/lib/components/trip/ViewToggle.svelte` -- replace localStorage with IndexedDB
- `src/routes/+layout.svelte` -- add verification/cleanup sweep on startup
- `tests/guardian-checklist.md` -- add IndexedDB regression guards
- All test files that reference localStorage -- update mocks

**ViewToggle.svelte Migration:**

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  import { dbGet, dbPut } from '$lib/stores/db';

  export let activeView: 'week' | 'day' = 'week';
  export let tripId: string;

  const dispatch = createEventDispatcher();

  onMount(async () => {
    const saved = await dbGet<string>('prefs', `hw-trip-view-${tripId}`);
    if (saved === 'week' || saved === 'day') {
      activeView = saved;
    }
  });

  function setView(view: 'week' | 'day') {
    activeView = view;
    dbPut('prefs', `hw-trip-view-${tripId}`, view);
    dispatch('change', view);
  }
</script>
```

**Global localStorage Verification:**

Add a startup check in `+layout.svelte` that warns if any `hw-*` keys are found in localStorage after migration:

```typescript
// In +layout.svelte onMount, after migration:
if (typeof localStorage !== 'undefined') {
  const staleKeys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('hw-') && k !== 'hw-idb-migration-complete') {
      staleKeys.push(k);
    }
  }
  if (staleKeys.length > 0) {
    console.warn('[HW-DB] Found stale localStorage keys after migration:', staleKeys);
    // Clean them up
    for (const k of staleKeys) localStorage.removeItem(k);
  }
}
```

**Test Infrastructure Updates:**

Many existing tests use `localStorage.removeItem()` in `beforeEach` to reset state. These need to be updated to use IndexedDB cleanup:

```typescript
// tests/helpers/reset-storage.ts
import 'fake-indexeddb/auto';

export async function resetAllStorage(): Promise<void> {
  // Clear IndexedDB
  const databases = await indexedDB.databases();
  for (const db of databases) {
    if (db.name) indexedDB.deleteDatabase(db.name);
  }
  // Clear localStorage (for migration flag)
  localStorage.clear();
}
```

**Guardian Checklist Updates (`tests/guardian-checklist.md`):**

Add these regression guards:
```markdown
## IndexedDB Storage (Ticket 025)
- [ ] No `hw-*` keys in localStorage (except `hw-idb-migration-complete`)
- [ ] Auth token persists in IndexedDB after login (check via DevTools > Application > IndexedDB > hw-travel > auth)
- [ ] Journal entries sync immediately on edit (no 2-second delay)
- [ ] Closing tab mid-journal-edit does not lose data
- [ ] Page refresh after login does not flash login screen
- [ ] Offline edits are queued and sync when online
- [ ] ViewToggle preference (week/day) persists across page loads
- [ ] Last-visited-path restoration works after login
```

**Implementation steps:**
1. Modify `src/lib/components/trip/ViewToggle.svelte`: replace localStorage with `dbGet`/`dbPut`.
2. Add localStorage verification/cleanup sweep to `src/routes/+layout.svelte`.
3. Update `tests/guardian-checklist.md` with IndexedDB regression guards.
4. Create `tests/helpers/reset-storage.ts` for test cleanup.
5. Update all existing test files that reference `localStorage.removeItem` or `localStorage.setItem` to use the new helpers.
6. Run full test suite. Run Playwright tests on mobile viewport.
7. **Final verification**: Open browser DevTools, confirm zero `hw-*` keys in localStorage (only `hw-idb-migration-complete`).
8. **Final verification**: Open IndexedDB in DevTools, confirm `hw-travel` database has all 6 object stores with data.

**Testing:**
```bash
# Playwright E2E -- full sweep
# tests/e2e/no-localstorage.spec.ts
# - Login, navigate around, edit journal, edit trip
# - Check: localStorage has ZERO hw-* keys (except migration flag)
# - Check: IndexedDB hw-travel database has auth, trips, journal data

# Vitest -- unit sweep
# npm test (all existing tests pass with updated mocks)
```

**Use specialized agents:**
```bash
claude "Use the code-writer agent to migrate ViewToggle.svelte to IndexedDB, add localStorage cleanup verification to +layout.svelte, and update test infrastructure following Phase 4 specifications from ticket 025"

claude "Use the code-quality-assessor agent to do a final codebase scan: grep for ANY remaining localStorage usage in src/ and flag it as a bug"

claude "Use the test-writer agent to create tests/e2e/no-localstorage.spec.ts that verifies zero localStorage usage after full app interaction"

claude "Use the test-critic agent to review all test changes for completeness -- every store, every route, every component must be covered"
```

**Build Verification:**
```bash
npm run build
npm run check
npm test
npm run test:e2e
```

**Commit**: `refactor(ui): complete localStorage-to-IndexedDB migration, add verification`

## Testing Strategy

### Data Safety Tests (Highest Priority)
1. **Journal immediate sync**: Edit journal text, immediately call `page.close()`, reopen -- text must be on server.
2. **Offline journal**: Disconnect network, edit journal, reconnect -- edits sync to server.
3. **Auth persistence**: Login, close all tabs, reopen -- should not see login screen.
4. **Migration correctness**: Pre-populate localStorage with all known keys, run migration, verify all data appears in IndexedDB and localStorage is empty.

### Regression Tests
1. All existing Vitest tests pass (with updated storage mocks).
2. All existing Playwright tests pass.
3. Chat store (not migrated -- it's purely in-memory) continues to work.
4. Photo queue (already uses IndexedDB) continues to work.
5. Trip creation via chat agent works (trip appears in IndexedDB).

### Cross-Browser Tests
1. Chrome desktop -- full test suite
2. Safari desktop -- verify IndexedDB works
3. iOS Safari -- verify IndexedDB persists across app switches
4. Chrome Android -- verify IndexedDB persistence

### Performance Tests
1. Measure time from page load to `isLoading: false` (auth hydration from IndexedDB). Must be <100ms.
2. Measure time to render trip page after navigation (trips store hydration). Must be <200ms.
3. Compare before/after: localStorage reads are ~0.1ms, IndexedDB reads are ~1-5ms. Verify no perceptible UI delay.

## Success Criteria
1. **Zero localStorage keys** with `hw-*` prefix (except `hw-idb-migration-complete` flag).
2. **Journal entries never lost** -- immediate sync eliminates the 2-second data-loss window.
3. **No login-screen flash** on page refresh for authenticated users.
4. **All existing tests pass** with updated storage mocks.
5. **Migration is invisible** -- existing users see no data loss or UI changes.
6. **Photo queue continues working** (it already uses IndexedDB, must not conflict with new `hw-travel` database).

## Dependencies
- `fake-indexeddb` npm dev dependency (for Vitest tests only)
- No runtime dependencies added -- uses raw IndexedDB API
- Existing `src/lib/services/photo-queue.ts` already uses a separate IndexedDB database (`hw-photo-queue`) and is unaffected

## Risks & Mitigations

1. **Risk**: IndexedDB unavailable in private browsing mode on some browsers.
   **Mitigation**: The `isBrowser` check returns null, and all `dbGet`/`dbPut` calls handle null gracefully. The app degrades to in-memory-only storage for the session. Auth still works (just won't persist across page loads in private mode -- same as current localStorage behavior in Safari private mode).

2. **Risk**: Auth hydration from IndexedDB adds perceptible delay to first render.
   **Mitigation**: IndexedDB reads for small values (token string, user JSON) complete in <5ms. The existing `isLoading: true` loading screen covers this. Benchmark in Phase 2 and optimize if needed.

3. **Risk**: Migration fails mid-way, leaving data split between localStorage and IndexedDB.
   **Mitigation**: The migration flag (`hw-idb-migration-complete`) is set only after all writes succeed. If it fails, next page load retries. Original localStorage data is not deleted until all writes succeed.

4. **Risk**: Multiple tabs open during migration cause conflicts.
   **Mitigation**: IndexedDB handles concurrent writes transactionally. The `onversionchange` handler in `db.ts` closes stale connections. The migration uses a localStorage flag which is shared across tabs, so only one tab runs the migration.

5. **Risk**: Removing journal debounce causes excessive network requests during rapid typing.
   **Mitigation**: Each keystroke in the journal does NOT trigger sync -- only explicit mutations (block content update, photo insert, etc.) do. The `updateBlockContent` method is called on blur/pause, not on every keypress. If performance is an issue, add a micro-debounce (100ms) that is short enough to fire before any realistic tab-close.

## Deployment Guide

### Infrastructure Changes

**No backend changes required.** This is a pure frontend refactor. The server API endpoints, FastAPI backend, and SQLite database are unchanged.

### Frontend Deployment
```bash
# Build and test locally
npm run build
npm run check
npm test
npm run test:e2e

# Deploy to GitHub Pages
npm run deploy
```

### Deployment Verification

**Manual Verification:**
1. Open https://heatherandwesley.com in Chrome DevTools
2. Application tab > IndexedDB > verify `hw-travel` database exists with 6 stores
3. Application tab > Local Storage > verify no `hw-*` keys (except migration flag)
4. Login, navigate to trip, edit journal entry, refresh -- data persists
5. Test on mobile Safari (iOS)

**Automated Verification:**
```bash
# Run E2E test that verifies no localStorage usage
npm run test:e2e -- --grep "no-localstorage"
```

### Rollback Plan
1. Revert the frontend commit and redeploy to GitHub Pages.
2. Data in IndexedDB will be orphaned but harmless -- the reverted code reads from localStorage.
3. Migration flag in localStorage can be removed to re-trigger migration if needed after a re-deploy.
4. No data loss risk on rollback because the server has all synced data.

```bash
git revert [commit-hash]
npm run build
npm run deploy
```

### Production Readiness Checklist
- [ ] All Vitest unit tests passing
- [ ] All Playwright E2E tests passing
- [ ] No `hw-*` keys in localStorage (verified in E2E test)
- [ ] IndexedDB `hw-travel` database has all 6 object stores
- [ ] Auth hydration completes in <100ms
- [ ] Journal sync is immediate (no debounce)
- [ ] Migration handles empty localStorage (new user scenario)
- [ ] Migration handles full localStorage (existing user scenario)
- [ ] Photo queue (`hw-photo-queue` database) unaffected
- [ ] Mobile Safari tested
- [ ] Guardian checklist updated with IndexedDB regression guards
