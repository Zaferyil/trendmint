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

## Endpoints

| Method | Path                       | Purpose                                   |
| ------ | -------------------------- | ----------------------------------------- |
| GET    | `/api/health`              | Reports which keys are configured         |
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
- `CLAUDE_MODEL` *(optional, defaults to `claude-sonnet-5`)*

Never give these a `VITE_` prefix — that prefix is what publishes a value to the
browser bundle.
