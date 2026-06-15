import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3500;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Supabase helper
function supabaseFetch(path, options = {}) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) throw new Error('Supabase configuration missing');

  return fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      'Prefer': options.prefer || '',
      ...options.headers
    }
  });
}

// GET /api/transactions - Read all transactions
app.get('/api/transactions', async (req, res) => {
  try {
    const response = await supabaseFetch('transactions?order=created_at.desc');
    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: errText });
    }
    const transactions = await response.json();
    res.json({ transactions });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read transactions' });
  }
});

// POST /api/transactions - Add a new transaction
app.post('/api/transactions', async (req, res) => {
  try {
    const { ticker, name, type, date, quantity, price, currency } = req.body;

    if (!ticker || !type || !date || quantity == null || price == null) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const validTypes = ['BUY', 'SELL'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid transaction type' });
    }

    if (quantity <= 0 || price <= 0) {
      return res.status(400).json({ error: 'Quantity and price must be positive' });
    }

    // For SELL transactions, validate user isn't selling more than they own
    if (type === 'SELL') {
      const holdingsRes = await supabaseFetch(`transactions?ticker=eq.${encodeURIComponent(ticker.toUpperCase())}&select=type,quantity`);
      if (holdingsRes.ok) {
        const txns = await holdingsRes.json();
        const held = txns.reduce((acc, t) => acc + (t.type === 'BUY' ? Number(t.quantity) : -Number(t.quantity)), 0);
        if (parseFloat(quantity) > held) {
          return res.status(400).json({ error: `Cannot sell ${quantity} shares. You only own ${held} shares of ${ticker.toUpperCase()}.` });
        }
      }
    }

    const transaction = {
      ticker: ticker.toUpperCase(),
      name: name || ticker.toUpperCase(),
      type,
      date,
      timestamp: Math.floor(new Date(date).getTime() / 1000),
      quantity: parseFloat(quantity),
      price: parseFloat(price),
      currency: currency || 'INR'
    };

    const response = await supabaseFetch('transactions', {
      method: 'POST',
      prefer: 'return=representation',
      body: JSON.stringify(transaction)
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: errText });
    }

    const [created] = await response.json();
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save transaction' });
  }
});

// DELETE /api/transactions/:id - Remove a transaction by ID
app.delete('/api/transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const response = await supabaseFetch(`transactions?id=eq.${id}`, {
      method: 'DELETE',
      prefer: 'return=representation'
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: errText });
    }

    const deleted = await response.json();
    if (deleted.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({ message: 'Transaction deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
});

// --- Currency conversion cache ---
let exchangeRates = {};  // e.g. { USD: 95.1 }
let ratesFetchedAt = 0;

async function getExchangeRate(fromCurrency) {
  if (fromCurrency === 'INR') return 1;

  const now = Date.now();
  // Cache rates for 10 minutes
  if (exchangeRates[fromCurrency] && (now - ratesFetchedAt < 10 * 60 * 1000)) {
    return exchangeRates[fromCurrency];
  }

  try {
    const pair = `${fromCurrency}INR=X`;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${pair}?interval=1d&range=1d`;
    const response = await fetch(url);
    const data = await response.json();
    const rate = data.chart?.result?.[0]?.meta?.regularMarketPrice;
    if (rate) {
      exchangeRates[fromCurrency] = rate;
      ratesFetchedAt = now;
      return rate;
    }
  } catch {}

  // Fallback rates if API fails
  return exchangeRates[fromCurrency] || 1;
}

// GET /api/stock-lookup/:ticker - Fetch company name and live price
app.get('/api/stock-lookup/:ticker', async (req, res) => {
  try {
    const rawTicker = req.params.ticker.toUpperCase();

    // Try ticker as-is first (US stocks), then with .NS (Indian/NSE), then .BSE
    const candidates = rawTicker.includes('.')
      ? [rawTicker]
      : [rawTicker, `${rawTicker}.NS`, `${rawTicker}.BO`];

    for (const ticker of candidates) {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.chart && data.chart.result && data.chart.result.length > 0) {
        const meta = data.chart.result[0].meta;
        if (meta.regularMarketPrice) {
          const currency = meta.currency || 'USD';

          return res.json({
            ticker: meta.symbol,
            name: meta.longName || meta.shortName || ticker,
            price: meta.regularMarketPrice,
            currency
          });
        }
      }
    }

    res.status(404).json({ error: 'Ticker not found' });
  } catch (err) {
    res.status(404).json({ error: `Could not find data for ticker: ${req.params.ticker}` });
  }
});

// GET /api/stock-search?q=query - Search/autocomplete for stocks
app.get('/api/stock-search', async (req, res) => {
  try {
    const query = req.query.q;
    if (!query || query.length < 1) {
      return res.json([]);
    }

    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=8&newsCount=0`;
    const response = await fetch(url);
    const data = await response.json();

    const results = (data.quotes || [])
      .filter(q => q.quoteType === 'EQUITY' && q.isYahooFinance)
      .map(q => ({
        symbol: q.symbol,
        name: q.longname || q.shortname || q.symbol,
        exchange: q.exchDisp || q.exchange
      }));

    res.json(results);
  } catch (err) {
    res.json([]);
  }
});

// POST /api/watchlist/add - Add ticker(s) to Supabase watchlist
app.post('/api/watchlist/add', async (req, res) => {
  const { ticker } = req.body;

  if (!ticker) {
    return res.status(400).json({ error: 'ticker is required' });
  }

  try {
    const response = await supabaseFetch('stocks_list', {
      method: 'POST',
      prefer: 'return=representation, resolution=merge-duplicates',
      body: JSON.stringify({ ticker })
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: errText });
    }

    const data = await response.json();
    // If the returned item has a non-empty algo_chandelier_exit, it already existed
    const alreadyExisted = Array.isArray(data) && data.length > 0 && data[0].algo_chandelier_exit && Object.keys(data[0].algo_chandelier_exit).length > 0;
    res.status(alreadyExisted ? 200 : 201).json({ data, alreadyExisted });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add ticker to watchlist' });
  }
});

// POST /api/chandelier-exit - Fetch chandelier exit data from Supabase
app.post('/api/chandelier-exit', async (req, res) => {
  const { tickers } = req.body;

  if (!Array.isArray(tickers) || tickers.length === 0) {
    return res.status(400).json({ error: 'tickers array is required' });
  }

  try {
    const response = await supabaseFetch('rpc/get_stocks_by_list', {
      method: 'POST',
      body: JSON.stringify({ ticker_list: tickers })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[chandelier-exit] Supabase error:', response.status, errText);
      return res.status(response.status).json({ error: errText });
    }

    const data = await response.json();
    console.log('[chandelier-exit] Request tickers:', tickers);
    console.log('[chandelier-exit] Response:', JSON.stringify(data, null, 2));
    res.json(data);
  } catch (err) {
    console.error('[chandelier-exit] Fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch chandelier exit data' });
  }
});

// GET /api/exchange-rate/:currency - Get exchange rate to INR
app.get('/api/exchange-rate/:currency', async (req, res) => {
  const currency = req.params.currency.toUpperCase();
  if (currency === 'INR') {
    return res.json({ currency: 'INR', rate: 1 });
  }
  const rate = await getExchangeRate(currency);
  res.json({ currency, rate });
});

// GET /api/moving-average/:ticker - Calculate moving averages from stock_candles
app.get('/api/moving-average/:ticker', async (req, res) => {
  try {
    const ticker = req.params.ticker.toUpperCase();
    const periods = (req.query.periods || '20,50').split(',').map(Number);

    // Fetch candle data ordered by date descending
    const response = await supabaseFetch(
      `stock_candles?ticker=eq.${encodeURIComponent(ticker)}&order=candle_date.desc&limit=100&select=candle_date,close`
    );

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: errText });
    }

    const candles = await response.json();

    if (candles.length === 0) {
      return res.status(404).json({ error: `No candle data found for ${ticker}` });
    }

    // Calculate moving averages for each requested period
    const movingAverages = {};
    for (const period of periods) {
      if (candles.length >= period) {
        const slice = candles.slice(0, period);
        const sum = slice.reduce((acc, c) => acc + Number(c.close), 0);
        movingAverages[`MA${period}`] = Math.round((sum / period) * 100) / 100;
      } else {
        movingAverages[`MA${period}`] = null;
      }
    }

    // Also return the latest close price and date
    res.json({
      ticker,
      latestClose: Number(candles[0].close),
      latestDate: candles[0].candle_date,
      candlesAvailable: candles.length,
      movingAverages
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to calculate moving averages' });
  }
});

// GET /api/stock-fundamentals/:ticker - Get fundamentals from stocks_list
app.get('/api/stock-fundamentals/:ticker', async (req, res) => {
  try {
    const ticker = req.params.ticker.toUpperCase();
    const response = await supabaseFetch(
      `stocks_list?ticker=eq.${encodeURIComponent(ticker)}&select=ticker,fifty_two_week_high,fifty_two_week_low,pe_ratio,current_price,fundamentals_updated_at`
    );

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: errText });
    }

    const data = await response.json();
    if (data.length === 0) {
      return res.status(404).json({ error: `Ticker ${ticker} not found in watchlist` });
    }

    res.json(data[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch fundamentals' });
  }
});

app.listen(PORT, () => {
  console.log(`Stock Tracker running at http://localhost:${PORT}`);
});

export default app;
