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

## 10. Guardian Claude

Automated regression protection. Runs after every `git push` (hook mode) and daily at 7:15am (daily mode).

| File | Purpose |
|------|---------|
| `scripts/guardian-claude.sh` | Launcher (modes, budget, notifications) |
| `scripts/guardian-claude-prompt.md` | Autonomous agent instructions |
| `tests/guardian-checklist.md` | Permanent regression guards (dev agent appends here) |
| `.claude/hooks/post-push-guardian.sh` | PostToolUse hook (git push trigger) |
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
