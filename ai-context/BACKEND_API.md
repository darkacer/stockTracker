# Backend API — server.js

> Express.js server (ESM). All routes proxy to Supabase REST API or Yahoo Finance. No direct DB driver.

## Core Helper

```js
supabaseFetch(path, options)  // Wraps fetch() with Supabase URL, apikey, Authorization headers
```

## API Routes

### Transactions (CRUD)

| Method | Path | What It Does |
|---|---|---|
| `GET` | `/api/transactions?user_id=X` | List all transactions (filtered by user_id if provided) |
| `POST` | `/api/transactions` | Create a BUY/SELL transaction. Validates: no selling more than owned. Auto-adds ticker to `stocks_list`. |
| `PATCH` | `/api/transactions/:id` | Update transaction fields (ticker, type, qty, price, target, stoploss). Whitelist of allowed fields. |
| `DELETE` | `/api/transactions/:id` | Delete a transaction by UUID. |

**Transaction fields:** `ticker, name, type (BUY/SELL), date, timestamp, quantity, price, currency, user_id, target_value, target_type, stoploss_value, stoploss_type`

### Users

| Method | Path | What It Does |
|---|---|---|
| `GET` | `/api/users` | List all users (id, name) from `users` table |

### Stock Data (Yahoo Finance proxy)

| Method | Path | What It Does |
|---|---|---|
| `GET` | `/api/stock-lookup/:ticker` | Live price + company name. Tries ticker as-is, then `.NS`, then `.BO` for Indian stocks. Uses Yahoo Finance v8 chart API. |
| `GET` | `/api/stock-search?q=query` | Autocomplete search. Yahoo Finance v1 search API. Returns symbol, name, exchange. Filters to EQUITY type only. |
| `GET` | `/api/exchange-rate/:currency` | Currency→INR rate via Yahoo Finance `XXXINR=X` pair. Cached 10 min. |

### Technical Indicators & Fundamentals

| Method | Path | What It Does |
|---|---|---|
| `POST` | `/api/chandelier-exit` | Fetches pre-computed CE data from `stocks_list` via Supabase RPC `get_stocks_by_list` |
| `GET` | `/api/moving-average/:ticker?periods=20,44` | Calculates MAs from `stock_candles` table (latest N rows) |
| `GET` | `/api/stock-fundamentals/:ticker` | 52W high/low, PE ratio, current_price, RSI from `stocks_list` |
| `POST` | `/api/holdings-data` | **Batch endpoint**: fundamentals + moving averages + signal_changes for multiple tickers in one call. Used by dashboard. |

### Watchlist

| Method | Path | What It Does |
|---|---|---|
| `POST` | `/api/watchlist/add` | Upsert ticker into `stocks_list`. Fire-and-forget. |

### Analysis Timestamps

| Method | Path | What It Does |
|---|---|---|
| `GET` | `/api/analysis-timestamps` | Returns last CE/OTT run times from `stocks_list.algo_chandelier_exit.updatedAt` / `algo_ott.updatedAt` |

## Data Flow

```
Frontend (app.js)
  → fetch('/api/...')
    → server.js route handler
      → supabaseFetch() → Supabase REST API → PostgreSQL
      → OR fetch() → Yahoo Finance API
    ← JSON response
  ← renders UI
```
