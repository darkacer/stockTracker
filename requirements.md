# Define the markdown content for the requirements document
requirements_content = """# Product Requirements Document (PRD): Simple Stock Tracker

## 1. Project Overview
The goal is to build a lightweight, modern, self-hosted web application to track stock purchases and sales. The application will run on a Node.js backend with a clean web UI. It uses a local JSON file for data storage, eliminating the need for an external database.

---

## 2. Tech Stack
- **Backend:** Node.js with Express.js (REST API).
- **Frontend:** HTML5, CSS3 (Tailwind CSS via CDN), Vanilla JavaScript (Fetch API).
- **Database:** Local JSON file (`portfolio.json`).
- **External API:** `yahoo-finance2` (NPM package) or a free financial API (like Finnhub) for real-time price lookups and auto-completing stock names.

---

## 3. Functional Requirements

### 3.1. Transaction Entry Form
The UI must feature a clean, user-friendly form to input both Buy and Sell transactions.
- **Fields Required:**
  - `Stock Ticker` (Text input, auto-capitalized, e.g., AAPL)
  - `Stock Name` (Text input, automatically populated via API when a valid ticker is entered)
  - `Transaction Type` (Dropdown or toggle switch: **BUY** or **SELL**)
  - `Date Purchased/Sold` (Date picker, defaults to today)
  - `Quantity` (Number, allows decimals for fractional shares)
  - `Price per Share` (Number, decimal, defaults to current market price via API lookup)

### 3.2. Data Storage & TradingView Compatibility
To ensure future compatibility with **TradingView Lightweight Charts**, dates must be saved as standard ISO strings and include standard Unix timestamps. Transactions must be easily groupable by ticker.

The data must be stored locally in `portfolio.json` with the following schema:

```json
{
  "transactions": [
    {
      "id": "uuid-v4-string",
      "ticker": "AAPL",
      "name": "Apple Inc.",
      "type": "BUY",
      "date": "2026-03-15",
      "timestamp": 1773619200,
      "quantity": 10,
      "price": 175.50
    },
    {
      "id": "uuid-v4-string",
      "ticker": "AAPL",
      "name": "Apple Inc.",
      "type": "SELL",
      "date": "2026-06-12",
      "timestamp": 1781222400,
      "quantity": 5,
      "price": 190.00
    }
  ]
}
```

3.3. API Integration
Implement an endpoint /api/stock-lookup/:ticker that queries a free service to fetch:

Full official company name (e.g., entering "MSFT" fetches "Microsoft Corporation").

The current live market price.

If the ticker cannot be found, fallback gracefully allowing the user to manually type the stock name.

3.4. Dashboard Views (UI Components)
The UI should feel modern, clean, and dashboard-oriented with three primary sections:

Summary Cards: - Total Invested: Total cost basis of current holdings.

Current Value: Current value of holdings based on live prices.

Total Realized PnL: Total profit/loss realized from SELL transactions.

Current Holdings Table: Aggregates transactions by ticker to show current open positions:

Ticker | Name | Total Shares Owned | Avg Buy Price | Current Price | Total Return ($ / %) (Color-coded)

Transaction Log: A simple historic ledger showing all past BUY/SELL events chronologically with an option to Delete a transaction.

4. UI/UX & Aesthetic Requirements
Theme: Modern Dark Mode aesthetic by default (inspired by TradingView/Robinhood).

Color Palette:

Background: Deep slate/black (#121214 or #1e293b)

Cards/Containers: Slightly lighter charcoal (#1f2937)

Accent / Bullish / Profit: Vivid Green (#10B981)

Bearish / Loss: Vibrant Red (#EF4444)

Interactivity: Smooth hover states, clear visual feedback for API fetching states, and validation prevention (e.g., preventing a user from selling more shares than they currently own).
"""