# Ticket 027: Migrate Travel App to bopthere.com

## Metadata
- **Status**: Complete
- **Priority**: High
- **Effort**: 13 points (Phase 1: 2pt, Phase 2: 5pt, Phase 3: 3pt, Phase 4: 2pt, Phase 5: 1pt)
- **Created**: 2026-05-05
- **Type**: chore
- **Depends on**: bopthere.com domain purchased (done)

## Problem Statement

The travel app lives at heatherandwesley.com, a domain that was originally the wedding site. The wedding is over (Dec 2025, Maui) and the app has evolved into a full travel planning tool. The domain no longer reflects what the app does, and Wesley & Heather want heatherandwesley.com freed up as a personal landing page.

**bopthere.com** has been purchased on Porkbun. The travel app, its API, and its data need to move to the new domain. AWS auth stays with heatherandwesley.com — bopthere gets its own auth system running on wabbazzar-ice alongside the existing FastAPI backend.

## User Stories

### Primary
As Wesley or Heather, I want to access the travel app at bopthere.com so that the app has its own identity separate from our personal/wedding site.

### Secondary
- As Wesley or Heather, I want heatherandwesley.com to be a personal landing page with access to the archived wedding site at /archive/.
- As a user of bopthere.com, I want to log in with credentials stored on wabbazzar-ice (not AWS Lambda) so the app is fully self-hosted.
- As a developer, I want the old AWS auth resources left untouched so the wedding archive can still use them if needed.

## Infrastructure Context

- **Current frontend**: GitHub Pages via this repo's `CNAME` -> heatherandwesley.com
- **Current API**: nginx on wabbazzar-ice reverse-proxies `api.heatherandwesley.com` -> `localhost:8089` (FastAPI `chat_proxy.py`)
- **Current auth**: AWS Lambda (`heatherandwesley-auth-handler`) + DynamoDB (`heatherandwesley-auth-users`), hit via API Gateway at `emwkjk2c9d.execute-api.us-east-1.amazonaws.com/prod`
- **Frontend auth service** (`src/lib/services/auth.ts`): Uses `PUBLIC_API_GATEWAY_URL` env var, calls `/auth/login`, `/auth/verify`, `/auth/refresh`
- **JWT**: HS256 with `JWT_SECRET` env var in `chat_proxy.py:57`. Same secret can sign tokens for new auth.
- **Data**: SQLite at `server/data/chat.db` (WAL mode), photos at `server/data/photos/`
- **Porkbun API**: Credentials in `~/.env` as `pork-key` and `pork-secret-key`

## Technical Requirements

### Phase 1: DNS + Nginx Setup (2pt)

Set up DNS for bopthere.com and configure the reverse proxy on wabbazzar-ice.

**Porkbun DNS records** (via API at `api.porkbun.com/api/json/v3/dns/create/bopthere.com`):

| Type | Name | Content | TTL |
|------|------|---------|-----|
| A | (root) | 185.199.108.153 | 600 |
| A | (root) | 185.199.109.153 | 600 |
| A | (root) | 185.199.110.153 | 600 |
| A | (root) | 185.199.111.153 | 600 |
| CNAME | www | wabbazzar.github.io | 600 |
| A | api | (wabbazzar-ice public IP) | 600 |

**Nginx on wabbazzar-ice**:
- Create `/etc/nginx/sites-available/api.bopthere.com` server block proxying to `localhost:8089`
- `sudo ln -s /etc/nginx/sites-available/api.bopthere.com /etc/nginx/sites-enabled/`
- `sudo certbot --nginx -d api.bopthere.com`
- `sudo nginx -t && sudo systemctl reload nginx`
- Keep `api.heatherandwesley.com` running in parallel

**Verification**: `dig bopthere.com` returns GitHub Pages IPs. `curl https://api.bopthere.com/health` returns 200.

### Phase 2: Local Auth System on wabbazzar-ice (5pt)

Add auth endpoints to the existing FastAPI app so bopthere.com authenticates against wabbazzar-ice instead of AWS Lambda.

**New file: `server/auth_db.py`**

```python
"""Auth database — separate SQLite file for bopthere user credentials."""

import hashlib
import os
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "data" / "auth.db"

def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.row_factory = sqlite3.Row
    return conn

def init_auth_db():
    """Create users table and seed default accounts."""
    conn = get_conn()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            username    TEXT PRIMARY KEY,
            password_hash TEXT NOT NULL,
            salt        TEXT NOT NULL,
            full_name   TEXT,
            role        TEXT NOT NULL DEFAULT 'user',
            created_at  TEXT NOT NULL DEFAULT (datetime('now'))
        )
    """)
    conn.commit()
    # Seed wesley and heather if not present
    for user in [
        ("wesley", "Wesley", "admin"),
        ("heather", "Heather", "admin"),
    ]:
        _seed_user(conn, user[0], user[1], user[2])
    conn.close()

def _seed_user(conn, username, full_name, role):
    existing = conn.execute("SELECT 1 FROM users WHERE username=?", (username,)).fetchone()
    if existing:
        return
    salt = os.urandom(32).hex()
    # Placeholder password — MUST be changed after deploy
    pw_hash = hashlib.sha256((f"changeme-{username}" + salt).encode()).hexdigest()
    conn.execute(
        "INSERT INTO users (username, password_hash, salt, full_name, role) VALUES (?,?,?,?,?)",
        (username, pw_hash, salt, full_name, role),
    )
    conn.commit()

def verify_password(username: str, password: str) -> dict | None:
    conn = get_conn()
    row = conn.execute("SELECT * FROM users WHERE username=?", (username,)).fetchone()
    conn.close()
    if not row:
        return None
    pw_hash = hashlib.sha256((password + row["salt"]).encode()).hexdigest()
    if pw_hash != row["password_hash"]:
        return None
    return {"username": row["username"], "full_name": row["full_name"], "role": row["role"]}

def get_user(username: str) -> dict | None:
    conn = get_conn()
    row = conn.execute("SELECT username, full_name, role FROM users WHERE username=?", (username,)).fetchone()
    conn.close()
    return dict(row) if row else None
```

**Modify: `server/chat_proxy.py`**

Add three routes that mirror the Lambda auth-handler's response shapes:

```python
# POST /auth/login
# Request: {"username": "...", "password": "..."}
# Response: {"token": "jwt...", "user": {"username": "...", "role": "..."}, "expires_at": "ISO8601"}

# POST /auth/verify
# Request: Authorization: Bearer <token>
# Response: {"user": {"username": "...", "role": "..."}}

# POST /auth/refresh
# Request: Authorization: Bearer <token>
# Response: {"token": "new-jwt...", "user": {...}, "expires_at": "ISO8601"}
```

These use the same `JWT_SECRET` already in chat_proxy.py (line 57), so tokens issued by `/auth/login` are automatically valid for all existing trip/chat/journal endpoints via the existing `verify_token()` function (line 141).

Add to `ALLOWED_ORIGINS`:
```python
"https://bopthere.com",
"https://www.bopthere.com",
```

**Testing**:
- Vitest unit tests for auth_db.py password hashing
- Integration test: login -> verify -> use token on /api/chat endpoint
- Test CORS headers from bopthere.com origin

### Phase 3: Domain Switchover in This Repo (3pt)

Update all domain references:

| File | Line(s) | Old | New |
|------|---------|-----|-----|
| `CNAME` | 1 | `heatherandwesley.com` | `bopthere.com` |
| `.env` | 2 | `PUBLIC_CHAT_API_URL=https://api.heatherandwesley.com` | `PUBLIC_CHAT_API_URL=https://api.bopthere.com` |
| `.env` | (add) | — | `PUBLIC_API_GATEWAY_URL=https://api.bopthere.com` |
| `.github/workflows/deploy.yml` | 43 | `https://api.heatherandwesley.com` | `https://api.bopthere.com` |
| `.github/workflows/deploy.yml` | (add) | — | `PUBLIC_API_GATEWAY_URL: https://api.bopthere.com` |
| `server/chat_proxy.py` | 55 | `H&W Chat Proxy` | `BopThere API` |
| `server/chat_proxy.py` | 60-67 | hw origins | bopthere origins (keep localhost entries) |
| `src/lib/services/auth.ts` | 1,5 | `PUBLIC_API_GATEWAY_URL` | `PUBLIC_CHAT_API_URL` |
| `CLAUDE.md` | throughout | heatherandwesley refs | bopthere refs |
| `tests/integration/test_cors_comprehensive.py` | domain refs | hw.com | bopthere.com |
| `tests/integration/backend/test_leaderboard_api.py` | origin headers | hw.com | bopthere.com |

**Key auth change**: `src/lib/services/auth.ts` line 1 changes from:
```typescript
import { PUBLIC_API_GATEWAY_URL } from '$env/static/public';
```
to:
```typescript
import { PUBLIC_CHAT_API_URL } from '$env/static/public';
```
And line 5: `const API_URL = PUBLIC_CHAT_API_URL;`

This means auth and data APIs both go through the same FastAPI server. The endpoint paths (`/auth/login`, `/auth/verify`, `/auth/refresh`) are identical in shape to what the Lambda returned.

**Verification**:
- `npm run build` succeeds
- `npm run check` passes
- Open bopthere.com in browser, login as wesley, verify trips/journal/todos/bookings load
- Playwright E2E suite passes

### Phase 4: heatherandwesley.com Landing Page (2pt)

**New repo**: `heatherandwesley-site` (or `heatherandwesley-landing`)

Contents:
```
CNAME                    # heatherandwesley.com
index.html               # Minimal personal landing page
archive/                 # Copy of static/archive/ from this repo
.github/workflows/deploy.yml  # Simple static deploy to GitHub Pages
```

The landing page should be clean and minimal:
- Wesley & Heather's names
- Brief personal tagline
- Link to /archive/ ("Our Wedding - December 2025, Maui")
- Optionally link to bopthere.com

**DNS**: heatherandwesley.com DNS records already exist on Porkbun. Verify GitHub Pages IPs are set. Update the GitHub repo settings to enable Pages with custom domain.

**After confirmed working**: Remove `static/archive/` and `src-react-archive/` from this repo.

### Phase 5: Cleanup (1pt)

- Move `aws/` directory to heatherandwesley-site repo (preserve for reference alongside the wedding archive)
- Move `infrastructure/` directory to heatherandwesley-site repo (same reason)
- Move AWS-specific Makefile targets to heatherandwesley-site repo's Makefile
- Then remove `aws/`, `infrastructure/`, and AWS Makefile targets from this repo
- Rename `server/hw-chat.service` to `server/bopthere.service`, update Description field
- Reinstall systemd service under new name on wabbazzar-ice
- Eventually remove old nginx block for `api.heatherandwesley.com`
- Update ticket numbering strategy for new repo identity

## Files to Create
- `server/auth_db.py` (new auth module)
- `server/bopthere.service` (renamed systemd unit)
- Nginx config for `api.bopthere.com` on wabbazzar-ice
- New repo `heatherandwesley-site` with landing page

## Files to Modify
- `CNAME`
- `.env`
- `.github/workflows/deploy.yml`
- `server/chat_proxy.py`
- `src/lib/services/auth.ts`
- `CLAUDE.md`
- Test files with domain references

## Files to Move to heatherandwesley-site (Phase 5)
- `aws/` — Lambda source, deploy scripts, auth handler (reference for legacy auth)
- `infrastructure/` — Terraform configs (reference for AWS resources)
- `static/archive/` — wedding site (served at heatherandwesley.com/archive/)
- `src-react-archive/` — old React source (reference only)
- AWS-specific Makefile targets

## Files to Remove from This Repo (after move)
- Above directories once safely in heatherandwesley-site
- `server/hw-chat.service` (replaced by bopthere.service)

## Deployment

### Phase 1 (wabbazzar-ice)
```bash
# DNS via Porkbun API (from dev machine)
# Nginx config (on wabbazzar-ice via SSH or direct)
sudo certbot --nginx -d api.bopthere.com
sudo systemctl reload nginx
```

### Phase 2 (wabbazzar-ice)
```bash
cd /home/wabbazzar/code/heatherandwesley/server
# After code changes merged:
systemctl --user restart hw-chat
curl https://api.bopthere.com/auth/login -X POST -d '{"username":"wesley","password":"changeme-wesley"}'
```

### Phase 3 (GitHub)
```bash
git push origin main  # Triggers GitHub Actions deploy
# GitHub Pages picks up new CNAME, serves bopthere.com
```

### Phase 4 (GitHub)
```bash
gh repo create wabbazzar/heatherandwesley-site --public
# Push landing page + archive
# Enable GitHub Pages in repo settings
```

## Out of Scope
- Migrating AWS auth users to bopthere (fresh start with 2 users)
- Renaming AWS resources (DynamoDB tables, Lambda functions)
- Redirecting old heatherandwesley.com/dashboard or /trip/* URLs to bopthere.com
- Mobile app or PWA changes (none exist yet)
- Changing the GitHub repo name from `heatherandwesley` to `bopthere` (unnecessary — custom domain handles it)

## Testing Strategy

### Phase 1
- `dig bopthere.com` returns GitHub Pages IPs
- `dig api.bopthere.com` returns wabbazzar-ice IP
- `curl https://api.bopthere.com/health` returns 200

### Phase 2
- Unit tests for `auth_db.py`: password hashing, user lookup, seed verification
- Integration: POST /auth/login with valid creds returns JWT
- Integration: POST /auth/verify with returned JWT returns user object
- Integration: use JWT from new auth on existing /api/chat endpoint (proves token compatibility)

### Phase 3
- `npm run build` && `npm run check` pass
- Playwright E2E suite on bopthere.com
- Manual: login, view trips, edit journal, check bookings, chat with Claude
- Mobile: test at 390px width on bopthere.com

### Phase 4
- heatherandwesley.com loads landing page
- heatherandwesley.com/archive/ loads wedding site
- No CORS or mixed-content errors

## Rollout Plan
1. Phase 1 first — DNS propagation takes time, start early
2. Phase 2 while DNS propagates — auth code can be tested on localhost
3. Phase 3 after DNS confirmed + auth tested — this is the cutover moment
4. Phase 4 can happen any time after Phase 3
5. Phase 5 is cleanup, no rush — do it after a week of bopthere.com running stable
