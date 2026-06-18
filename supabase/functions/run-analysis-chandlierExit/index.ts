import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.0'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  try {
    // 1. Grab our active watchlist (including current chandelier state)
    const { data: stocks, error: stocksError } = await supabase
      .from('stocks_list')
      .select('ticker, algo_chandelier_exit');

    if (stocksError || !stocks) throw new Error("Could not fetch target watchlist.");

    const executionSummary = [];

    for (const stock of stocks) {
      const ticker = stock.ticker;

      // 2. Fetch the latest 100 candles (desc) then reverse for chronological calculation
      const { data: candlesDesc, error: candleError } = await supabase
        .from('stock_candles')
        .select('high, low, close, candle_date')
        .eq('ticker', ticker)
        .order('candle_date', { ascending: false })
        .limit(100);

      if (candleError || !candlesDesc || candlesDesc.length < 23) {
        continue; // Insufficient history to generate a stabilized ATR runway
      }

      const candles = candlesDesc.reverse();

      // 3. Process Chandelier Exit (Everget's Pine Script v6 — exact port)
      const length = 22;
      const mult = 3.0;
      const total = candles.length;

      // Build TR array
      const tr: number[] = [];
      tr.push(Number(candles[0].high) - Number(candles[0].low));
      for (let i = 1; i < total; i++) {
        const hl = Number(candles[i].high) - Number(candles[i].low);
        const hc = Math.abs(Number(candles[i].high) - Number(candles[i - 1].close));
        const lc = Math.abs(Number(candles[i].low) - Number(candles[i - 1].close));
        tr.push(Math.max(hl, hc, lc));
      }

      // RMA-ATR: seed with SMA, then Wilder's smoothing — matches Pine's ta.atr(length)
      let rmaVal = tr.slice(0, length).reduce((a, b) => a + b, 0) / length;
      const rmaAtr: number[] = new Array(length).fill(0);
      rmaAtr[length - 1] = rmaVal;
      for (let i = length; i < total; i++) {
        rmaVal = (tr[i] + (length - 1) * rmaVal) / length;
        rmaAtr.push(rmaVal);
      }

      // Seed from first valid bar (i = length-1): nz(longStop[1], longStop) = longStop (no prev)
      const initSlice = candles.slice(0, length);
      const initHighest = Math.max(...initSlice.map(c => Number(c.close)));
      const initLowest  = Math.min(...initSlice.map(c => Number(c.close)));
      const initAtr = rmaAtr[length - 1] * mult;
      let longStopPrev  = initHighest - initAtr;
      let shortStopPrev = initLowest  + initAtr;
      const firstClose = Number(candles[length - 1].close);
      let dir = firstClose > shortStopPrev ? 1 : firstClose < longStopPrev ? -1 : 1;
      let prevDir = dir;

      for (let i = length; i < total; i++) {
        const cCurr = Number(candles[i].close);
        const cPrev = Number(candles[i - 1].close);
        const offset = rmaAtr[i] * mult;

        const window = candles.slice(i - length + 1, i + 1);
        const highestVal = Math.max(...window.map(c => Number(c.close)));
        const lowestVal = Math.min(...window.map(c => Number(c.close)));

        const longStopRaw = highestVal - offset;
        const shortStopRaw = lowestVal + offset;

        const longStop = (cPrev > longStopPrev) ? Math.max(longStopRaw, longStopPrev) : longStopRaw;
        const shortStop = (cPrev < shortStopPrev) ? Math.min(shortStopRaw, shortStopPrev) : shortStopRaw;

        prevDir = dir;
        dir = (cCurr > shortStopPrev) ? 1 : (cCurr < longStopPrev) ? -1 : dir;

        longStopPrev = longStop;
        shortStopPrev = shortStop;
      }

      const marketState = (dir === 1) ? "BULLISH" : "BEARISH";
      let currentSignal = "HOLD";
      if (dir === 1 && prevDir === -1) currentSignal = "BUY";
      if (dir === -1 && prevDir === 1) currentSignal = "SELL";

      // 4. Detect signal change before updating
      const oldState = stock.algo_chandelier_exit?.marketState || null;
      if (oldState && oldState !== marketState) {
        await supabase
          .from('signal_changes')
          .insert({
            ticker,
            indicator: 'chandelier_exit',
            old_value: oldState,
            new_value: marketState
          });
        console.log(`[signal-change] ${ticker}: ${oldState} → ${marketState}`);
      }

      // 5. Update the pre-computed JSON payload directly into the stocks_list record
      const calculationPayload = {
        marketState,
        currentSignal,
        asOf: candles[total - 1].candle_date,
        updatedAt: new Date().toISOString()
      };

      await supabase
        .from('stocks_list')
        .update({ algo_chandelier_exit: calculationPayload })
        .eq('ticker', ticker);

      executionSummary.push({ ticker, status: 'Analyzed', changed: oldState !== marketState });
    }

    return new Response(JSON.stringify({ success: true, processed: executionSummary }), {
      headers: { "Content-Type": "application/json" },
      status: 200
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});