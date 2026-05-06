# BopThere - Development Guidelines

Personal travel planning app for Wesley & Heather. Built with SvelteKit, deployed to GitHub Pages at bopthere.com.

The old wedding website (React) is archived at heatherandwesley.com/archive/.

## 0. Dev Server

**ALWAYS keep the dev server running.** If it's not running, start it before doing anything else:
```bash
npm run dev -- --port 5174 &
```
Never kill the dev server. If it crashes, restart it immediately.

## 0.5. Host Detection

Check which machine you're running on:
```bash
hostname
```
- **`wabbazzar-ice`**: You are on the server. You have direct access to `server/data/bopthere.db` (SQLite), ticket PDFs in `server/data/tickets/`, and the systemd service. No SSH or API auth needed — read/write the DB directly via `python3 -c "from db import ..."` from the `server/` directory.
- **Any other host**: You are on a dev machine. Access server data through the API (`https://api.heatherandwesley.com`) with a JWT token, or SSH into `wabbazzar-ice`.

## 1. Project Architecture

### Technology Stack
- **Frontend**: SvelteKit 2, Svelte 5, TypeScript
- **Styling**: Tailwind CSS (minimal now, designed to be skinned later)
- **Build**: Vite, `@sveltejs/adapter-static` (GitHub Pages)
- **App Backend**: FastAPI (Python) on `wabbazzar-ice`, in-repo at `server/`, SQLite persistence
- **Auth Backend**: AWS Lambda (Python 3.11) + API Gateway + DynamoDB (legacy — being migrated to wabbazzar-ice)
- **Deployment**: GitHub Pages with custom domain

### Key Directories
```
src/
  routes/              # SvelteKit pages
    +page.svelte       # Login portal (default landing)
    +layout.svelte     # Auth guard + nav header
    dashboard/         # Trip listing
    trip/[id]/         # Trip detail view
  lib/
    services/auth.ts   # AWS API Gateway auth client
    stores/auth.ts     # Svelte auth store
    types/             # TypeScript types
    data/              # Trip data (static for now)
server/                # FastAPI backend — runs on wabbazzar-ice
  chat_proxy.py        # FastAPI app (chat + bookings endpoints)
  db.py                # SQLite helpers (bopthere.db)
  data/                # SQLite DB + ticket PDFs (GITIGNORED — contains secrets)
  bopthere.service      # systemd unit
  requirements.txt
aws/lambda/            # Lambda function source (legacy auth only)
infrastructure/        # Terraform configs (legacy, prefer Makefile)
static/archive/        # Archived wedding site (served at /archive/)
src-react-archive/     # Old React source (reference only)
public/app-uploads/    # Image assets
```

### FastAPI Backend (`server/`)

Lives inside this repo and runs on `wabbazzar-ice` as a systemd service:
- **Service unit**: `server/bopthere.service` (user unit, `systemctl --user status bopthere`)
- **Bind**: `127.0.0.1:8089` — reverse-proxied by Caddy to `https://api.bopthere.com`
- **Auth**: local auth via `server/auth_db.py` (separate SQLite at `server/data/auth.db`), HS256 JWT (Bearer token in `Authorization` header)
- **Persistence**: single SQLite file at `server/data/bopthere.db` (WAL mode)
- **LLM**: shells out to the local Claude Code CLI (`CLAUDE_BIN`, uses Max plan OAuth) — NOT the Anthropic API, NOT AWS Bedrock
- **Sensitive storage**: `server/data/` is gitignored and holds both the SQLite DB and any booking PDFs. Nothing in there should be committed.

**Endpoints (current)**:
- `GET /health` — liveness
- `POST /auth/login` — authenticate, returns JWT
- `POST /auth/verify` — validate JWT, returns user
- `POST /auth/refresh` — refresh JWT
- `GET /api/chat/conversations/{trip_id}` — fetch chat history
- `POST /api/chat/messages` — send a message, get a Claude reply
- `DELETE /api/chat/conversations/{trip_id}` — clear history
- Full CRUD for trips, journal, todos, bookings, scripts, photos

**Architecture note**: Auth and all data endpoints are on the same FastAPI server. No AWS Lambda dependencies. The old AWS API Gateway (`emwkjk2c9d`) is legacy and only used by heatherandwesley.com.

## 2. Development Approach

### Incremental & Autonomous
- Work on one small, testable component at a time
- Proceed autonomously, communicate progress clearly
- Prefer editing existing files over creating new ones

### Code Quality Rules
- **NO FALLBACK LOGIC**: Always fail loudly and explicitly — this speeds up debugging. Silent fallbacks hide bugs for weeks.
- **NO STRAY FILES AT REPO ROOT**: The root is reserved for config files. Scratch files go in `tmp/`, test fixtures in `tests/`, docs in `docs/`.
- **AVOID UNICODE CHARACTERS**: Never use unicode box-drawing characters in markdown files — they corrupt to binary. Use ASCII alternatives (`+--| / \ [ ]`).
- **CRITICAL: NEVER OVERWRITE EXISTING FILES**: Always use Read tool to check existing content before editing or creating files.

### Skinnable Design Philosophy
- Keep structure and logic separate from presentation
- Use minimal Tailwind for layout, avoid hardcoded visual themes
- Design components so a CSS theme/skin can be layered on later
- Multiple skins should be possible without changing component logic

### UI Component Guidelines (Mobile-First)
- **Mobile button/element overflow**: Buttons and interactive elements MUST NOT hang off screen edges on mobile. Use `whitespace-nowrap`, reduce padding on mobile, use tighter gaps.
- **Modals must be vertically centered**: Always use `items-center` for modal containers, never bottom-sheet patterns unless explicitly requested.
- **Touch targets**: All interactive elements must be at least 44px in the tap dimension.
- **Test at 390px width**: iPhone SE is the baseline. If it breaks there, it's a bug.

### GUI Verification for UI Features

**This is a HARD REQUIREMENT. No exceptions.**

Before declaring ANY UI feature "complete", you MUST:

1. **Ensure the dev server is running** (see section 0)
2. **Open the app** using `dev-browser` and navigate to the affected page(s)
3. **Verify every user-facing interaction path** works end-to-end:
   - Can the user actually FIND the feature? (Is the button/link visible?)
   - Can the user actually TRIGGER the feature? (Does clicking it do something?)
   - Does the component actually RENDER correctly?
   - Does the happy path complete successfully?
4. **Take screenshots** as proof of working state
5. **Include screenshots in your response** to the user

**Features that only exist in code but are unreachable in the UI are NOT features.** A modal that never opens, a button hidden behind a condition that is never true, an event handler with no trigger — these are BUGS, not features.

**If you cannot verify a UI feature with dev-browser** (e.g., requires server auth, specific device), you MUST explicitly tell the user what you could NOT verify and why, rather than claiming it works.

**NEVER ask the user to manually test UI changes** — use the `dev-browser` skill to visually verify yourself.

## 3. SvelteKit Conventions

### Component Structure
- Use Svelte 5 runes syntax where applicable
- TypeScript for all `.ts` files
- Svelte stores for shared state (`$lib/stores/`)
- Services for API calls (`$lib/services/`)
- Types in `$lib/types/`

### Environment Variables
- Use `PUBLIC_` prefix for client-side env vars (SvelteKit convention)
- Current: `PUBLIC_CHAT_API_URL` in `.env` (used for both auth and data APIs)
- Access via `$env/static/public`

### Routing
- `ssr = false` and `prerender = true` in root layout (static SPA mode)
- Dynamic routes need `export const prerender = false` in their `+page.ts`
- `fallback: 'index.html'` in adapter config handles client-side routing

## 4. Auth System

### How It Works
- JWT tokens (30-day expiry, HS256) from FastAPI on wabbazzar-ice (`server/auth_db.py`)
- Token stored in IndexedDB (via `$lib/stores/db`)
- Root layout checks auth state, redirects unauthenticated users to `/`
- Login hits `POST /auth/login` with `{username, password}`
- Token verify hits `POST /auth/verify` with `Authorization: Bearer <token>`
- Auth and data endpoints share the same server (`api.bopthere.com`)

### Users
- Users stored in SQLite at `server/data/auth.db`
- Wesley's account: username `wesley`, role `admin`
- Heather's account: username `heather`, role `admin`
- Auth module: `server/auth_db.py`

## 5. AWS Configuration

**ALL AWS RESOURCES MUST BE IN US-EAST-1 (N. VIRGINIA)**

```bash
# Always use these flags
--profile personal --region us-east-1
```

- **NO Terraform/OpenTofu** for new resources - Use AWS CLI and Makefile only
- **Use PyPI** (not CodeArtifact) for Python dependencies
- **Avoid binary dependencies** in Lambda (use pure Python alternatives)
- Create Makefile targets for all deployment operations

### Lambda Deployment
```bash
make deploy-[function]-lambda    # New function
make update-[function]-lambda    # Update existing
make test-[function]             # Verify
```

## 6. Build and Deployment

### Verify Before Finishing
```bash
npm run build
npm run check   # svelte-check
```

### Static Build
- Output goes to `build/`
- Archive wedding site is in `static/archive/` (copied to `build/archive/` on build)
- GitHub Pages serves from `build/`

## 7. Git Commit Standards

### Format
```
<type>(<scope>): <subject under 50 chars>

- Brief explanation of what changed
- Why this change was needed
```

**NEVER include AI attribution signatures** - no Co-Authored-By, no Generated-with lines.

### Types
`feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

### Scopes
`auth`, `trip`, `ui`, `dashboard`, `archive`, `infra`

## 8. File Organization

- **`tmp/`** - ALL temporary/scratch files
- **`@local/`** - Files staged for deletion
- **`tests/`** - All tests (unit, integration, e2e subdirs)
- **`static/archive/`** - Archived wedding site (do not modify)
- **`src-react-archive/`** - Old React source (reference only, do not modify)

## 9. Important Reminders

- This is a private travel app for Wesley & Heather only
- Mobile-first responsive design
- Function first, aesthetics later (skinnable architecture)
- The wedding is over (Dec 2025, Maui). The archive preserves that site.
- Current focus: travel planning, starting with China trip (Apr-May 2026)

## 10. Testing Culture — TDD Is Mandatory

### Philosophy
Every feature, fix, or refactor MUST have tests that prove it works. Not toy unit tests that check obvious things — **real integration tests that click buttons, edit fields, and verify the DOM changes**. If an agent writes code, it writes a test first or alongside.

### Why This Matters for Agents
Agents hallucinate APIs, misremember function signatures, and guess at component outputs. Tests are the ground truth. Before recommending a store method, grep for it. Before assuming a component renders a class name, run a Playwright test that checks. **Never trust code review alone — trust the browser.**

### Test Types and When to Use Each

| Type | Tool | Speed | Use For |
|------|------|-------|---------|
| **Unit tests** | Vitest (`npm test`) | ~500ms | Pure logic: store calculations, date math, string builders, service helpers |
| **Integration E2E** | Playwright (`npm run test:e2e`) | ~17s | Real browser: clicking buttons, editing fields, verifying persistence, navigation flows |
| **Guardian ad-hoc** | Guardian Claude daily | ~3min | Exploratory: AI navigates app, checks for console errors, visual anomalies |

### Rules for Writing Tests

1. **Integration tests > unit tests.** A Playwright test that clicks "Add Day" and verifies the count increased catches real bugs. A unit test that checks `1 + 1 === 2` does not.
2. **Test the user's experience, not implementation details.** Don't test Svelte reactivity internals — test that the h1 says "China 2026" after reset.
3. **Never use Svelte-scoped CSS class names as selectors.** Svelte 5 hashes class names. Use: `aria-label`, `role`, `[title=]`, text content, `getByRole`, `getByPlaceholder`, `data-testid`. 
4. **Tests must break when the feature breaks.** If you can delete the feature code and the test still passes, the test is worthless.
5. **Reset state between tests.** Use `localStorage.removeItem()` in `beforeEach` to prevent test pollution.
6. **Verify persistence.** If data should survive navigation or reload, write a test that navigates away and back, or reloads the page.
7. **Handle browser dialogs.** Use `page.once('dialog', d => d.accept())` BEFORE the click that triggers `confirm()`.
8. **Force-click hidden elements.** Buttons behind `opacity: 0` (hover-reveal) need `dispatchEvent('click')` or `click({ force: true })`.

### Known Patterns (from real bugs found by tests)

- **Mutation leak bug:** Store defaults must be deep-cloned, not shallow-spread. `{ ...defaults }` copies references, so in-place mutations corrupt the "default" data. Always use `JSON.parse(JSON.stringify(defaults))`. This bug was caught by the Reset integration test.
- **Svelte 5 class scoping:** `page.locator('.day-nav')` will FAIL because Svelte generates `.day-nav.s-xxxxx`. Use `button[aria-label="Next day"]` instead.

### Dev Agent Responsibilities (THIS MEANS YOU)

When you change UI components, stores, services, or API integrations:

1. **Write tests alongside the code.** Vitest for pure logic, Playwright for anything the user clicks or sees. No PR without tests.
2. **Update `tests/guardian-checklist.md`** if you add new interactive elements, API endpoints, or data flows. Guardian Claude reads this checklist — if it's not listed, it's not guarded.
3. **Run `npm test` before committing.** The pre-commit hook will block you if vitest fails. Don't try to skip it.
4. **Run `npm run test:e2e` for UI changes.** The pre-commit hook only runs vitest (fast). Playwright tests are your responsibility to run for component changes.
5. **After push, check `tmp/guardian-result.json`.** Guardian Claude runs automatically on push. If it fails, fix it before moving on.

### What triggers guardian checklist updates

| You changed... | Update checklist with... |
|---------------|------------------------|
| New button/form/toggle | What it does, how to verify it works |
| New API endpoint | Health check URL and expected status code |
| Store logic (trips, chat, auth) | What invariants to check (e.g., "reset restores defaults") |
| Data persistence | What should survive reload |
| Mobile-specific behavior | Viewport size + what to verify |

### Hooks (automatic, don't disable)

| Hook | Trigger | What it does |
|------|---------|-------------|
| `pre-commit-tests.sh` | `git commit` | Runs `npx vitest run`, blocks commit if tests fail |
| `post-push-guardian.sh` | `git push` | Launches Guardian Claude in hook mode (background) |

## 11. Guardian Claude

Automated regression protection. Runs after every `git push` (hook mode) and daily at 7:15am (daily mode).

| File | Purpose |
|------|---------|
| `scripts/guardian-claude.sh` | Launcher (modes, budget, notifications) |
| `scripts/guardian-claude-prompt.md` | Autonomous agent instructions |
| `tests/guardian-checklist.md` | Permanent regression guards (dev agent appends here) |
| `.claude/hooks/pre-commit-tests.sh` | PreToolUse hook (blocks commit if vitest fails) |
| `.claude/hooks/post-push-guardian.sh` | PostToolUse hook (git push triggers guardian) |
| `.claude/settings.json` | Hook registration (pre-commit + post-push) |
| `tmp/guardian-result.json` | Last run results |
| `tmp/guardian-last-run.log` | Last run full output |

### Running manually
```bash
bash scripts/guardian-claude.sh hook   # Fast: script checks + vitest (~60s)
bash scripts/guardian-claude.sh daily  # Full: scripts + vitest + Playwright + GUI + DB (~3-5min)
```

### Test commands
```bash
npm test              # vitest unit tests
npm run test:e2e      # Playwright E2E tests
npm run check         # svelte-check + TypeScript
```
