# Stock Tracker: API Documentation

All endpoints are served by the Express.js backend (`server.js`) which proxies to Supabase and Yahoo Finance.

**Base URL:** `http://localhost:3500` (dev) or `https://stock-tracker-murex.vercel.app` (prod)

---

## 1. Transactions

### GET /api/transactions

Returns all portfolio transactions ordered by most recent first.

**Response (`200`):**
```json
{
  "transactions": [
    {
      "id": "uuid",
      "ticker": "INFY.NS",
      "name": "Infosys Limited",
      "type": "BUY",
      "date": "2026-06-15T17:03",
      "timestamp": 1781800980,
      "quantity": 10,
      "price": 1580.5,
      "currency": "INR",
      "created_at": "2026-06-15T11:33:00+00:00"
    }
  ]
}
```

---

### POST /api/transactions

Add a new BUY or SELL transaction.

**Request Body:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `ticker` | String | Yes | Stock ticker symbol |
| `name` | String | No | Company name (defaults to ticker) |
| `type` | String | Yes | `BUY` or `SELL` |
| `date` | String | Yes | ISO datetime (e.g. `2026-06-15T17:03`) |
| `quantity` | Number | Yes | Number of shares (must be > 0) |
| `price` | Number | Yes | Price per share (must be > 0) |
| `currency` | String | No | Currency code (defaults to `INR`) |

**Example:**
```json
{
  "ticker": "AAPL",
  "name": "Apple Inc.",
  "type": "BUY",
  "date": "2026-06-15T17:03",
  "quantity": 12,
  "price": 291.13,
  "currency": "USD"
}
```

**Response (`201`):** Returns the created transaction object.

**Validation:**
- SELL transactions check you don't sell more than you own.
- Returns `400` for missing fields, invalid type, or non-positive values.

---

### DELETE /api/transactions/:id

Delete a transaction by its UUID.

**Response (`200`):**
```json
{ "message": "Transaction deleted" }
```

**Error (`404`):**
```json
{ "error": "Transaction not found" }
```

---

## 2. Stock Lookup & Search

### GET /api/stock-lookup/:ticker

Fetches live price and company name from Yahoo Finance. Tries the ticker as-is, then appends `.NS` and `.BO` for Indian stocks.

**Response (`200`):**
```json
{
  "ticker": "INFY.NS",
  "name": "Infosys Limited",
  "price": 1580.5,
  "currency": "INR"
}
```

---

### GET /api/stock-search?q=query

Autocomplete/search for stock tickers via Yahoo Finance.

**Query Params:**

| Param | Description |
| --- | --- |
| `q` | Search query (min 1 character) |

**Response (`200`):**
```json
[
  {
    "symbol": "INFY.NS",
    "name": "Infosys Limited",
    "exchange": "NSI"
  }
]
```

---

## 3. Exchange Rate

### GET /api/exchange-rate/:currency

Returns the exchange rate from the given currency to INR. Rates are cached for 10 minutes.

**Response (`200`):**
```json
{ "currency": "USD", "rate": 95.1 }
```

---

## 4. Chandelier Exit

### POST /api/chandelier-exit

Fetches pre-computed Chandelier Exit signals from the Supabase `stocks_list` table (populated by the `run-analysis-chandlierExit` edge function).

**Request Body:**
```json
{ "tickers": ["INFY.NS", "AAPL", "NVDA"] }
```

**Response (`200`):**
```json
[
  {
    "id": 1,
    "ticker": "INFY.NS",
    "algo_chandelier_exit": {
      "asOf": "2026-06-12",
      "marketState": "BULLISH",
      "currentSignal": "BUY"
    }
  }
]
```

---

## 5. Watchlist

### POST /api/watchlist/add

Add a ticker to the Supabase `stocks_list` watchlist. Uses upsert — duplicates are safely ignored.

**Request Body:**
```json
{ "ticker": "AAPL" }
```

**Response (`201` new / `200` existing):**
```json
{
  "data": [{ "id": 12, "ticker": "AAPL", "algo_chandelier_exit": {} }],
  "alreadyExisted": false
}
```

---

## 6. Moving Average

### GET /api/moving-average/:ticker?periods=20,44

Calculates moving averages from the `stock_candles` table (trading days only).

**Query Params:**

| Param | Default | Description |
| --- | --- | --- |
| `periods` | `20,50` | Comma-separated list of MA periods to calculate |

**Response (`200`):**
```json
{
  "ticker": "INFY.NS",
  "latestClose": 1580.5,
  "latestDate": "2026-06-15",
  "candlesAvailable": 100,
  "movingAverages": {
    "MA20": 1565.23,
    "MA44": 1542.87
  }
}
```

**Notes:**
- Returns `null` for a period if fewer candles exist than the period requires.
- Candle data is populated by the `fetch-yfinance` Supabase edge function (fetches 100 trading days).

---

## 7. Stock Fundamentals

### GET /api/stock-fundamentals/:ticker

Returns 52-week high/low, PE ratio, and current price from the `stocks_list` table.

**Response (`200`):**
```json
{
  "ticker": "AAPL",
  "fifty_two_week_high": 317.4,
  "fifty_two_week_low": 195.07,
  "pe_ratio": null,
  "current_price": 291.13,
  "fundamentals_updated_at": "2026-06-15T10:00:00Z"
}
```

**Error (`404`):**
```json
{ "error": "Ticker AAPL not found in watchlist" }
```

---

## Error Codes Reference

| HTTP Status | Condition | Solution |
| --- | --- | --- |
| `400` | Missing/invalid fields | Check request body |
| `404` | Ticker or transaction not found | Verify the resource exists |
| `500` | Server or Supabase failure | Check server logs |