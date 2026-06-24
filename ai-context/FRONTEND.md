# Frontend — public/app.js & public/index.html

> Single-page app. No framework. Vanilla JS with Tailwind CSS (CDN).

## UI Layout (index.html)

```
<header>            → Logo, CE/OTT last-run timestamps, "Pure Bullish Stocks" link, user avatar switcher
<transaction-panel> → Slide-out left drawer for adding transactions (form with autocomplete)
<main>
  ├── Summary Cards (5 cards: Invested, Current Value, Unrealized P&L, Realized P&L with period filter, Total P/L %)
  ├── Current Holdings Table (sortable, with indicators: MA20, MA44, 52W High/Low, %B52WH, RSI, CE, OTT, Return, T/SL)
  ├── Transaction Log (sortable, editable inline, CSV import/export)
  ├── Realized P&L Breakdown (sortable table filtered by period)
  └── Portfolio Heatmap (placeholder section with "Analyze Distribution" button)
</main>
<csv-import-modal>  → Preview + confirm CSV bulk import
<toast-container>   → Top-right notification toasts
```

## Key Global State Variables

| Variable | Type | Purpose |
|---|---|---|
| `currentUserId` | string | Active user ID (persisted in localStorage) |
| `cachedUsers` | array | All users from API |
| `cachedHoldingsRows` | array | Computed holdings with all indicator data (for re-sorting without re-fetching) |
| `cachedTransactions` | array | Transaction log entries with pre-rendered HTML |
| `holdingsSortCol` / `holdingsSortAsc` | string/bool | Current holdings sort state |
| `transactionsSortCol` / `transactionsSortAsc` | string/bool | Current transactions sort state |
| `window._cachedRealizedSells` | array | All SELL P&L records (for realized breakdown) |
| `window._cachedRates` | object | Currency exchange rates `{ USD: 95.1, ... }` |
| `window._signalChanges` | array | Recent CE/OTT signal changes (last 3 days) |
| `currentLookupCurrency` | string | Currency from last ticker lookup (default 'INR') |
| `isEditMode` | bool | Whether transaction log is in inline edit mode |

## Key Functions

### Initialization
- `loadUsers()` → Fetches users, renders avatar/menu, then calls `loadDashboard()`
- `loadDashboard()` → Fetches transactions, renders transaction log + holdings
- `loadAnalysisTimestamps()` → Shows when CE/OTT edge functions last ran

### API Helpers (all return promises)
- `apiStockLookup(ticker)` → GET /api/stock-lookup/:ticker
- `apiStockSearch(query)` → GET /api/stock-search
- `apiExchangeRate(currency)` → GET /api/exchange-rate/:currency
- `apiGetTransactions()` → GET /api/transactions (filtered by currentUserId)
- `apiAddTransaction(payload)` → POST /api/transactions
- `apiDeleteTransaction(id)` → DELETE /api/transactions/:id
- `apiChandelierExit(tickers)` → POST /api/chandelier-exit
- `apiAddToWatchlist(ticker)` → POST /api/watchlist/add
- `apiMovingAverage(ticker, periods)` → GET /api/moving-average/:ticker
- `apiStockFundamentals(ticker)` → GET /api/stock-fundamentals/:ticker

### Core Rendering
- `renderHoldings(transactions)` → **Main function.** Aggregates transactions → holdings, fetches live prices + CE + fundamentals + MAs in parallel, computes all indicators, renders table rows.
- `renderTransactionLog(transactions)` → Renders transaction table, caches rows for sorting.
- `rerenderHoldings()` / `rerenderTransactions()` → Re-sort and re-render from cached data (no API calls).
- `updateRealizedCards()` → Filters realized sells by period, updates summary cards + breakdown table.

### Holdings Computation (inside renderHoldings)
1. Sort transactions chronologically
2. Aggregate by ticker: track `totalShares`, `totalCost`, `realizedPnl` using FIFO avg cost
3. For SELL: `pnl = (sellPrice - avgCost) * quantity`
4. Fetch in parallel: live prices (Yahoo), CE signals (Supabase), fundamentals + MAs (batch endpoint)
5. Fetch exchange rates for all currencies
6. Build row objects with: ticker, shares, avgPrice, current, ma20, ma44, weekHigh/Low, rsi, CE, OTT, return%, tsl indicators

### Color Coding Logic
- **Current price**: Red if below both MA20 & MA44 AND CE SELL AND OTT SELL. Green if above both AND CE BUY AND OTT BUY. White otherwise.
- **MA columns**: Green if price ≥ MA, Red if price < MA
- **RSI**: Green ≤ 30, Yellow 30-70, Red ≥ 70
- **%B52WH**: Green ≤ 10%, Yellow ≤ 25%, Red > 25%

### Formatting
- `formatINR(num)` → Indian numbering: `₹xx,xx,xxx.xx`
- `formatCurrency(num, currency)` → Uses currency symbol map: `{ INR: '₹', USD: '$', ... }`

### Transaction Panel
- Slide-out left drawer with autocomplete ticker search
- `searchTickers(query)` → Debounced dropdown with Yahoo search results
- `lookupTicker(ticker)` → Auto-fills name + price from Yahoo
- `prefillTransaction(ticker, name, type, price, currency)` → Opens panel pre-filled (from B/S buttons on holdings)

### CSV Import/Export
- `parseCSV(text)` → Custom parser handling quoted fields
- `handleCSVImport(event)` → File reader → preview modal → confirm → batch API calls
- `exportHoldingsCSV()` / `exportTransactionsCSV()` → Download as CSV

### Edit Mode (Transactions)
- `toggleEditTransactions()` → Replaces table cells with inline inputs
- `saveOneTransaction(id)` → PATCH single row
- `saveEditedTransactions()` → PATCH all rows sequentially
