# Database & Supabase Edge Functions

## Database Tables (Supabase PostgreSQL)

### `transactions`
Main portfolio data. Created by migration `20260615000000_create_transactions.sql`.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | Auto-generated |
| `ticker` | text | e.g. `INFY.NS`, `AAPL` |
| `name` | text | Company name |
| `type` | text | `BUY` or `SELL` (check constraint) |
| `date` | text | ISO datetime string |
| `timestamp` | bigint | Unix epoch seconds |
| `quantity` | numeric | Must be > 0 |
| `price` | numeric | Must be > 0 |
| `currency` | text | Default `INR` |
| `user_id` | uuid (FK) | References `users.id` (added after initial migration) |
| `target_value` | numeric | Optional target price/percentage |
| `target_type` | text | `percentage` or `amount` |
| `stoploss_value` | numeric | Optional stop loss price/percentage |
| `stoploss_type` | text | `percentage` or `amount` |
| `created_at` | timestamptz | Auto |

RLS enabled with open policy (all access allowed).

### `users`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `name` | text | Display name |

### `stocks_list` (Watchlist + indicator cache)
Central table for all tracked tickers. Edge functions write computed data here.

| Column | Type | Notes |
|---|---|---|
| `id` | serial | |
| `ticker` | text (unique) | Stock symbol |
| `algo_chandelier_exit` | jsonb | `{ marketState, currentSignal, asOf, updatedAt }` |
| `algo_ott` | jsonb | `{ marketState, currentSignal, mavg, ott, asOf, updatedAt }` |
| `fifty_two_week_high` | numeric | From Yahoo Finance |
| `fifty_two_week_low` | numeric | From Yahoo Finance |
| `pe_ratio` | numeric | Trailing or forward PE |
| `current_price` | numeric | Latest regular market price |
| `rsi` | numeric | RSI(14) Wilder's smoothing |
| `fundamentals_updated_at` | timestamptz | When Yahoo data was last fetched |

### `stock_candles` (OHLC price history)
| Column | Type | Notes |
|---|---|---|
| `id` | serial | |
| `ticker` | text | |
| `candle_date` | date | |
| `open` | numeric | |
| `high` | numeric | |
| `low` | numeric | |
| `close` | numeric | |
| `updated_at` | timestamptz | |

Unique constraint on `(ticker, candle_date)` for upsert.

### `signal_changes` (Indicator state transitions)
| Column | Type | Notes |
|---|---|---|
| `id` | serial | |
| `ticker` | text | |
| `indicator` | text | `chandelier_exit` or `ott` |
| `old_value` | text | Previous state e.g. `BULLISH` |
| `new_value` | text | New state e.g. `BEARISH` |
| `changed_at` | timestamptz | Auto (default now()) |

### RPC Functions
- `get_stocks_by_list(ticker_list text[])` → Returns stocks_list rows matching tickers
- `get_moving_averages(ticker_list text[], periods int[])` → Computes MAs in-database from stock_candles

---

## Supabase Edge Functions (Deno)

All run as HTTP-triggered Deno functions. Intended to be called periodically (cron or manual).

### `fetch-yfinance` — Data Ingestor
**File:** `supabase/functions/fetch-yfinance/index.ts`

**What it does:**
1. Reads all tickers from `stocks_list`
2. For each ticker, fetches 100-day candle data from Yahoo Finance v8 chart API
3. Extracts fundamentals: 52W high/low, current price from chart meta
4. Computes RSI(14) using Wilder's smoothing (matches TradingView)
5. Fetches PE ratio from Yahoo v10 quoteSummary API
6. Updates `stocks_list` with fundamentals + RSI
7. Upserts OHLC candles into `stock_candles` table

**Uses:** `SUPABASE_SERVICE_ROLE_KEY` for privileged writes.

### `run-analysis-chandlierExit` — Chandelier Exit Calculator
**File:** `supabase/functions/run-analysis-chandlierExit/index.ts`

**Algorithm:** Everget's Pine Script v6 port
- ATR period: 22, Multiplier: 3.0
- Uses RMA (Wilder's Moving Average) for ATR
- Computes long/short stops with ratchet logic
- Determines: `marketState` (BULLISH/BEARISH) and `currentSignal` (BUY/SELL/HOLD)
- Logs state changes to `signal_changes` table
- Writes result JSON to `stocks_list.algo_chandelier_exit`

**Requires:** ≥23 candles in `stock_candles` for the ticker.

### `run-analysis-ott` — Optimized Trend Tracker
**File:** `supabase/functions/run-analysis-ott/index.ts`

**Algorithm:** KivancOzbilgic / Anil Ozeksi OTT (Pine Script port)
- Uses VAR (Variable Moving Average) with length=2, percent=1.4
- VAR uses CMO (Chande Momentum Oscillator) over 9-bar window
- Computes OTT stops, direction, and BUY/SELL signal (MAvg vs OTT[2])
- Logs signal changes to `signal_changes`
- Writes result to `stocks_list.algo_ott`

**Reference Pine Script:** `supabase/functions/pineconeScript/ott.py`

### `get-indicator` — Single Ticker Indicator Reader
**File:** `supabase/functions/get-indicator/index.ts`

Simple read-only function. Takes `?ticker=X` query param, returns cached `algo_chandelier_exit` data from `stocks_list`.

---

## Data Pipeline Flow

```
Yahoo Finance APIs
       │
       ▼
[fetch-yfinance]  ──→ stock_candles (OHLC data)
                  ──→ stocks_list (fundamentals, RSI)
       │
       ▼
[run-analysis-chandlierExit] ──→ stocks_list.algo_chandelier_exit
                              ──→ signal_changes
       │
       ▼
[run-analysis-ott]           ──→ stocks_list.algo_ott
                              ──→ signal_changes
       │
       ▼
server.js (reads stocks_list, stock_candles)
       │
       ▼
app.js (renders holdings with all indicators)
```
