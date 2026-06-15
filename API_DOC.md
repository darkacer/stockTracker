# Stock Analysis Engine: API Documentation

This documentation outlines the core endpoints for interacting with your Supabase-backed market analysis system. Use these endpoints to interface your Salesforce Apex backend or external tools with your stock registry and pre-computed Chandelier Exit indicators.

### Global Configuration

* **Base URL:** `https://YOUR_PROJECT_ID.supabase.co/rest/v1`
* **Authentication:** All requests must include standard Supabase security credentials.

### Required HTTP Headers

| Header | Value | Description |
| --- | --- | --- |
| `apikey` | `YOUR_SUPABASE_ANON_KEY` | Your project's public anonymous API key. |
| `Authorization` | `Bearer YOUR_SUPABASE_ANON_KEY` | Bearer token authentication wrapper. |
| `Content-Type` | `application/json` | Explicitly declares JSON payload delivery. |

---

## 1. Fetch Selected Stocks Matrix (Batch RPC)

Queries the database for multiple tickers simultaneously using a JSON list passed directly in the request body. Returns all database columns, including the cached Chandelier Exit execution parameters.

* **Endpoint:** `/rpc/get_stocks_by_list`
* **HTTP Method:** `POST`

### Request Body Parameters

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `ticker_list` | Array [String] | **Yes** | A clean array of targeted stock strings to scan (e.g., `["AAPL", "TSLA"]`). |

#### Example Request Body

```json
{
  "ticker_list": ["AAPL", "NVDA", "RELIANCE.NS"]
}

```

### Response Payload (`200 OK`)

```json
[
  {
    "id": 1,
    "ticker": "AAPL",
    "created_at": "2026-06-14T19:53:00+00:00",
    "algo_chandelier_exit": {
      "asOf": "2026-06-12",
      "marketState": "BULLISH",
      "updatedAt": "2026-06-14T21:00:00.021Z",
      "currentSignal": "HOLD"
    }
  },
  {
    "id": 3,
    "ticker": "NVDA",
    "created_at": "2026-06-14T20:15:32+00:00",
    "algo_chandelier_exit": {
      "asOf": "2026-06-12",
      "marketState": "BEARISH",
      "updatedAt": "2026-06-14T21:00:00.045Z",
      "currentSignal": "SELL"
    }
  }
]

```

---

## 2. Add New Tickers to Watchlist (Single or Bulk)

Adds brand new market identifiers to your tracking matrix. This endpoint utilizes native Postgres upsert tracking, meaning duplicate ticker conflicts are safely ignored without crashing your system.

* **Endpoint:** `/stocks_list`
* **HTTP Method:** `POST`

### Additional Context Headers

To ensure optimal performance and duplicate resolution, add this header to the request:

```http
Prefer: return=representation, resolution=merge-duplicates

```

### Request Body Options

#### Option A: Single Ticker Injection (JSON Object)

```json
{
  "ticker": "INFY.NS"
}

```

#### Option B: Bulk Watchlist Ingestion (JSON Array)

```json
[
  {"ticker": "AMD"},
  {"ticker": "TCS.NS"},
  {"ticker": "MSFT"}
]

```

### Response Payload (`201 Created`)

Returns an array showing the newly generated database IDs and empty slots waiting for the background engine (`run-analysis-chandlierExit`) to populate them.

```json
[
  {
    "id": 12,
    "ticker": "AMD",
    "created_at": "2026-06-14T21:18:44.891+00:00",
    "algo_chandelier_exit": {}
  },
  {
    "id": 13,
    "ticker": "TCS.NS",
    "created_at": "2026-06-14T21:18:44.891+00:00",
    "algo_chandelier_exit": {}
  }
]

```

---

## Standard Error Codes Reference

When designing your Salesforce Apex integration handlers, plan to catch these core system database responses:

| HTTP Status | Supabase Internal Error Code | Trigger Condition | Solution |
| --- | --- | --- | --- |
| **`42501`** | `42501` | Row-Level Security (RLS) block. | Run the `DISABLE ROW LEVEL SECURITY` or assign policies via the SQL Editor. |
| **`400 Bad Request`** | PGRST100 | Malformed JSON array nesting or invalid column reference. | Verify fields match table layout precisely. |
| **`409 Conflict`** | `23505` | Unique constraint violation (`ticker` duplication). | Append the `resolution=merge-duplicates` preference to your transaction headers. |