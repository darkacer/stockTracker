# Stock Tracker — AI Context Overview

> **Purpose:** Help AI models quickly understand this codebase. Start here, then drill into topic-specific files in this folder.

## What This App Does

A self-hosted **stock portfolio tracker** with real-time prices, technical indicators (Chandelier Exit, OTT), and multi-user support. Users add BUY/SELL transactions, view current holdings with live prices, and monitor algorithmic trading signals.

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Node.js + Express.js (ESM modules) — `server.js` |
| **Frontend** | Vanilla JS + Tailwind CSS (CDN) — `public/` |
| **Database** | Supabase (PostgreSQL + REST API) |
| **Edge Functions** | Supabase Deno edge functions — `supabase/functions/` |
| **External API** | Yahoo Finance (prices, search, fundamentals) |
| **Deployment** | Vercel (serverless) |
| **Package Manager** | npm (only 2 deps: `express`, `dotenv`) |

## File Map

```
server.js                          → Express API server (all backend routes)
public/
  index.html                       → Single-page UI (Tailwind CSS)
  app.js                           → All frontend logic (no framework, vanilla JS)
  style.css                        → Custom styles (scrollbar, animations)
  images/                          → Static assets (favicon.png)
portfolio.json                     → Legacy sample data (app now uses Supabase)
package.json                       → Node deps: express, dotenv
vercel.json                        → Vercel deployment config
API_DOC.md                         → API endpoint documentation
requirements.md                    → Original PRD (partially outdated)
supabase/
  config.toml                      → Local Supabase dev config
  migrations/
    20260615000000_create_transactions.sql → Initial schema
  functions/
    fetch-yfinance/index.ts        → Fetches candles + fundamentals from Yahoo → Supabase
    get-indicator/index.ts         → Reads cached Chandelier Exit for a single ticker
    run-analysis-chandlierExit/index.ts → Batch Chandelier Exit computation
    run-analysis-ott/index.ts      → Batch OTT (Optimized Trend Tracker) computation
    pineconeScript/ott.py          → Pine Script reference for OTT algorithm
localCheck/
  ce.js                            → Local Chandelier Exit test script (reads CSV)
  *.csv                            → Sample candle data for local testing
```

## Key Architectural Patterns

1. **Server is a thin proxy**: `server.js` has NO direct DB connection. It calls Supabase REST API via `fetch()` using `supabaseFetch()` helper.
2. **All frontend state is in-memory**: `app.js` uses global variables (`cachedHoldingsRows`, `cachedTransactions`, etc.). No state management library.
3. **Holdings are computed client-side**: The server returns raw transactions; the frontend aggregates them into holdings (avg cost, P&L) in `renderHoldings()`.
4. **Technical indicators are pre-computed**: Edge functions run periodically to compute CE/OTT signals and store them in `stocks_list.algo_chandelier_exit` / `algo_ott` JSONB columns.
5. **Currency conversion**: All values are converted to INR for summary display. Exchange rates cached 10 min server-side.
6. **Multi-user**: Users stored in Supabase `users` table. Selected via avatar dropdown. Transactions filtered by `user_id`.

## Environment Variables

```
SUPABASE_URL          → Supabase project URL
SUPABASE_ANON_KEY     → Supabase anonymous/public key
PORT                  → Server port (default: 3500)
```

Edge functions also use:
```
SUPABASE_SERVICE_ROLE_KEY → For privileged DB operations in edge functions
```

## Quick Start

```bash
npm install
cp .env.example .env  # Add SUPABASE_URL and SUPABASE_ANON_KEY
npm run dev            # Starts on http://localhost:3500 with --watch
```
