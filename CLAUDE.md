# H&W Travel Portal - Development Guidelines

Personal travel planning app for Wesley & Heather. Built with SvelteKit, deployed to GitHub Pages.

The old wedding website (React) is archived and served at `/archive/`.

## 0. Dev Server

**ALWAYS keep the dev server running.** If it's not running, start it before doing anything else:
```bash
npm run dev -- --port 5174 &
```
Never kill the dev server. If it crashes, restart it immediately.

## 1. Project Architecture

### Technology Stack
- **Frontend**: SvelteKit 2, Svelte 5, TypeScript
- **Styling**: Tailwind CSS (minimal now, designed to be skinned later)
- **Build**: Vite, `@sveltejs/adapter-static` (GitHub Pages)
- **Auth Backend**: AWS Lambda (Python 3.11) + API Gateway + DynamoDB
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
aws/lambda/            # Lambda function source
infrastructure/        # Terraform configs (legacy, prefer Makefile)
static/archive/        # Archived wedding site (served at /archive/)
src-react-archive/     # Old React source (reference only)
public/app-uploads/    # Image assets
```

### API Gateway
- **Correct API ID**: `emwkjk2c9d`
- **Base URL**: `https://emwkjk2c9d.execute-api.us-east-1.amazonaws.com/prod`
- **Auth endpoints**: `/auth/login`, `/auth/verify`, `/auth/refresh`, `/auth/register`
- **Other endpoints**: `/rsvp`, `/photos`, `/leaderboard`, `/bingo`
- **NOTE**: There is also `4q7jj56io8` which only has `/leaderboard` routes. Do NOT use it for auth.

## 2. Development Approach

### Incremental & Autonomous
- Work on one small, testable component at a time
- Proceed autonomously, communicate progress clearly
- Prefer editing existing files over creating new ones

### Skinnable Design Philosophy
- Keep structure and logic separate from presentation
- Use minimal Tailwind for layout, avoid hardcoded visual themes
- Design components so a CSS theme/skin can be layered on later
- Multiple skins should be possible without changing component logic

## 3. SvelteKit Conventions

### Component Structure
- Use Svelte 5 runes syntax where applicable
- TypeScript for all `.ts` files
- Svelte stores for shared state (`$lib/stores/`)
- Services for API calls (`$lib/services/`)
- Types in `$lib/types/`

### Environment Variables
- Use `PUBLIC_` prefix for client-side env vars (SvelteKit convention)
- Current: `PUBLIC_API_GATEWAY_URL` in `.env`
- Access via `$env/static/public`

### Routing
- `ssr = false` and `prerender = true` in root layout (static SPA mode)
- Dynamic routes need `export const prerender = false` in their `+page.ts`
- `fallback: 'index.html'` in adapter config handles client-side routing

## 4. Auth System

### How It Works
- JWT tokens (30-day expiry, HS256) from AWS Lambda
- Token stored in localStorage (`hw-auth-token`, `hw-auth-user`)
- Root layout checks auth state, redirects unauthenticated users to `/`
- Login hits `POST /auth/login` with `{username, password}`
- Token verify hits `POST /auth/verify` with `Authorization: Bearer <token>`

### Users
- Real users exist in DynamoDB table `heatherandwesley-auth-users` (38 users)
- Wesley's account: username `wesley`, role `admin`
- Heather's account: username `heather`, role `admin`
- Lambda handler: `aws/lambda/auth-handler.py`

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
