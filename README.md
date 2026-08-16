# TrendMint

Turns marketplace trends into print-on-demand design concepts. React + Vite frontend
with a small backend proxy for every third-party API call.

## Why a backend proxy

Etsy and Anthropic do not send CORS headers for browser origins, so calling them
directly from React fails with a CORS error — and any key exposed via `VITE_*`
ends up readable in the deployed JavaScript bundle. Both problems are solved the
same way: the browser only talks to `/api/*` on its own origin, and the proxy
adds the secret keys server-side.

```
Browser  →  /api/etsy-trends       →  proxy (key added here)  →  api.etsy.com
Browser  →  /api/generate-design   →  proxy (key added here)  →  api.anthropic.com
```

The routing logic lives in `server/lib/router.js` and is shared by both runtimes:

- **Production (Netlify):** `netlify/functions/api.js`, reached through the
  `/api/*` redirect in `netlify.toml`.
- **Local development:** `server/dev-server.js`, a dependency-free Node server on
  port 3001 that Vite proxies to (see `vite.config.js`).

## Authentication

The app is closed: the UI shows a sign-in screen, and every endpoint except
`/api/health` and the auth routes returns `401` without a session. Gating only
the UI would leave the API — and the Claude/OpenAI spend behind it — open to
anyone who knows the URL.

Accounts are created by an admin from inside the app; there is no public
sign-up and no password-reset email (there is no mail service wired up, so an
admin resets passwords instead). The first admin comes from `ADMIN_EMAIL` /
`ADMIN_PASSWORD` and is created only while the user store is empty.

- **Passwords:** scrypt with a per-user random salt, via `node:crypto`.
- **Sessions:** an HMAC-signed, `HttpOnly` + `SameSite=Strict` cookie, so page
  script cannot read it. Each request re-checks it against the stored user, so
  disabling an account or changing a password takes effect immediately rather
  than whenever the cookie happens to expire.
- **Throttling:** five failed sign-ins lock an address for 15 minutes.
- **Storage:** Netlify Blobs in production, in-memory locally (users you create
  against `npm run dev:api` disappear when it restarts).

## Automation

Trend analysis and design generation can run on a schedule with nobody looking
at the app. Netlify fixes a cron expression at deploy time, so the schedule
cannot live in the cron itself — `auto-run-scheduled.mjs` is a plain hourly
heartbeat that asks the stored settings whether anything is due. On a six-hour
interval, four of those twenty-four wake-ups do work and the rest return having
spent one storage read and no API calls.

The work is handed to `auto-run-background.mjs`, because a scheduled function is
capped at 30 seconds and a run needs longer. That function is publicly
reachable, so the hop carries a key derived from `SESSION_SECRET` — no extra
variable to configure, and it is not interchangeable with a session signature.

```
hourly cron → auto-run-scheduled  → due?  no  → return
                                  → due?  yes → auto-run-background (15 min)
                                                 → Etsy trends
                                                 → Claude design concepts
                                                 → optional artwork
                                                 → archive + run log
```

Settings live in the **Saved Designs** tab: on/off, the gap between runs (1–24
hours), designs per run (1–5), trend window, and how long to keep designs. Any
signed-in user can read them; only an admin can change them or press **Run
now**. The gap is stored in hours rather than as runs per day, which could only
express divisors of 24 — a five- or seven-hour schedule was not reachable.
Settings saved under the old field are migrated on read.

**Cost.** Every run spends real money on the Claude and OpenAI accounts, and it
does so unattended. Automation is off by default, and artwork generation is a
second switch that is also off — a run that only writes concepts is roughly a
tenth the cost of one that draws them. Concepts keep their `imagePrompt`, so you
can generate artwork later from the archive for the ones worth it. Run history
in the same panel shows what each run actually did.

Scheduled functions only fire on **published** deploys, not branch or preview
deploys. After deploying, confirm the schedule registered under the site's
Functions tab.

## Endpoints

| Method | Path                       | Purpose                                   |
| ------ | -------------------------- | ----------------------------------------- |
| GET    | `/api/health`              | Liveness; key details once signed in      |
| POST   | `/api/auth/login`          | Sign in, sets the session cookie          |
| POST   | `/api/auth/logout`         | Clears the session cookie                 |
| GET    | `/api/auth/me`             | The signed-in user, or `null`             |
| POST   | `/api/auth/change-password`| Change your own password                  |
| GET    | `/api/users`               | List users *(admin)*                      |
| POST   | `/api/users`               | Create a user *(admin)*                   |
| POST   | `/api/users/update`        | Rename, change role, enable/disable *(admin)* |
| POST   | `/api/users/reset-password`| Set a user's password *(admin)*           |
| POST   | `/api/users/delete`        | Delete a user *(admin)*                   |
| GET    | `/api/automation/settings` | Schedule, run state, next run             |
| POST   | `/api/automation/settings` | Change the schedule *(admin)*             |
| POST   | `/api/automation/run-now`  | Start a run immediately *(admin)*         |
| GET    | `/api/automation/runs`     | Recent run history                        |
| GET    | `/api/designs`             | The saved-design archive                  |
| GET    | `/api/design-image`        | Artwork for one design (`id`)             |
| POST   | `/api/designs/delete`      | Delete a saved design *(admin)*           |
| GET    | `/api/etsy-trends`         | Trending Etsy listings (`category`, `limit`) |
| GET    | `/api/etsy-shop-listings`  | Active listings for a shop (`shopId`)     |
| POST   | `/api/generate-design`     | Claude design for a trend (`trendName`)   |
| POST   | `/api/generate-variations` | Claude design variations (`trendName`, `count`) |
| GET    | `/api/best-sellers`        | Amazon placeholder (no data source yet)   |

Missing keys return `501` and the UI falls back to its demo data instead of breaking.

## Setup

```bash
npm install
cp .env.example .env    # fill in ETSY_API_KEY and ANTHROPIC_API_KEY
```

Run the proxy and the frontend in two terminals:

```bash
npm run dev:api   # http://localhost:3001/api
npm run dev       # http://localhost:5173  (/api is proxied to 3001)
```

## Deploying to Netlify

Netlify picks up `netlify.toml` automatically (build `npm run build`, publish
`dist`, functions `netlify/functions`). Add the keys under
**Site settings → Environment variables**:

- `ETSY_API_KEY`
- `ANTHROPIC_API_KEY`
- `SESSION_SECRET` — required, or sign-in returns `503`. Generate with
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — the first admin, seeded only while no users
  exist. Sign in, change the password when prompted, then remove both.
- `CLAUDE_MODEL` *(optional, defaults to `claude-sonnet-5`)*

Never give these a `VITE_` prefix — that prefix is what publishes a value to the
browser bundle.
