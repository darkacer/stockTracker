import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.0'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// RSI(14) using Wilder's smoothing — same method as TradingView
function computeRSI(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }
  avgGain /= period;
  avgLoss /= period;
  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (change > 0 ? change : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (change < 0 ? Math.abs(change) : 0)) / period;
  }
  if (avgLoss === 0) return 100;
  return Math.round((100 - 100 / (1 + avgGain / avgLoss)) * 100) / 100;
}

Deno.serve(async (req) => {
  try {
    const results = [];

    // 1. DYNAMICALLY FETCH TICKERS INSIDE THE ASYNC HANDLER
    const { data: stocks, error: stocksError } = await supabase
      .from('stocks_list')
      .select('ticker');

    if (stocksError || !stocks) {
      return new Response(JSON.stringify({ error: "Could not fetch stock list from database" }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const TICKERS = stocks.map(s => s.ticker);

    // 2. LOOP THROUGH THE TICKERS AND FETCH FROM YAHOO FINANCE
    for (const ticker of TICKERS) {
      const yfUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=100d`;
      const response = await fetch(yfUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });

      if (!response.ok) continue;

      const json = await response.json();
      const chartResult = json?.chart?.result?.[0];
      if (!chartResult) continue;

      const timestamps = chartResult.timestamp || [];
      const quote = chartResult.indicators?.quote?.[0];
      const meta = chartResult.meta || {};
      
      if (!quote || timestamps.length === 0) continue;

      // --- Extract fundamentals from meta ---
      const fiftyTwoWeekHigh = meta.fiftyTwoWeekHigh ?? null;
      const fiftyTwoWeekLow = meta.fiftyTwoWeekLow ?? null;
      const currentPrice = meta.regularMarketPrice ?? null;

      // --- Compute RSI(14) from close prices (Wilder's smoothing = TradingView default) ---
      const closes: number[] = timestamps
        .map((_: number, i: number) => quote.close[i])
        .filter((c: number) => c != null);
      const rsi = computeRSI(closes);

      // --- Fetch PE ratio from quote summary ---
      let peRatio = null;
      try {
        const summaryUrl = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=defaultKeyStatistics,summaryDetail`;
        const summaryRes = await fetch(summaryUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        if (summaryRes.ok) {
          const summaryJson = await summaryRes.json();
          const summaryDetail = summaryJson?.quoteSummary?.result?.[0]?.summaryDetail;
          peRatio = summaryDetail?.trailingPE?.raw ?? summaryDetail?.forwardPE?.raw ?? null;
        }
      } catch (e) {
        console.error(`Error fetching PE for ${ticker}:`, e.message);
      }

      // --- Update stocks_list with fundamentals ---
      const { error: updateError } = await supabase
        .from('stocks_list')
        .update({
          fifty_two_week_high: fiftyTwoWeekHigh,
          fifty_two_week_low: fiftyTwoWeekLow,
          pe_ratio: peRatio,
          current_price: currentPrice,
          rsi,
          fundamentals_updated_at: new Date().toISOString()
        })
        .eq('ticker', ticker);

      if (updateError) {
        console.error(`Error updating fundamentals for ${ticker}:`, updateError.message);
      }

      // --- Upsert candle data ---
      const upsertRows = [];

      for (let i = 0; i < timestamps.length; i++) {
        if (quote.open[i] == null || quote.high[i] == null || quote.low[i] == null || quote.close[i] == null) {
          continue;
        }

        const dateStr = new Date(timestamps[i] * 1000).toISOString().split('T')[0];

        upsertRows.push({
          ticker: ticker,
          candle_date: dateStr,
          open: quote.open[i],
          high: quote.high[i],
          low: quote.low[i],
          close: quote.close[i],
          updated_at: new Date().toISOString()
        });
      }

      if (upsertRows.length > 0) {
        const { error } = await supabase
          .from('stock_candles')
          .upsert(upsertRows, { onConflict: 'ticker,candle_date' });

        if (error) {
          console.error(`Error upserting ${ticker}:`, error.message);
        } else {
          results.push({ 
            ticker, 
            status: 'Success', 
            rows: upsertRows.length,
            fiftyTwoWeekHigh,
            fiftyTwoWeekLow,
            peRatio,
            currentPrice
          });
        }
      }
    }

    return new Response(JSON.stringify({ success: true, processed: results }), {
      headers: { "Content-Type": "application/json" },
      status: 200
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500
    });
  }
});