import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.0'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// OTT defaults matching Pine Script by KivancOzbilgic / Anil Ozeksi
const OTT_LENGTH = 2;
const OTT_PERCENT = 1.4;

// VAR (Variable Moving Average) — exact port of Var_Func from Pine Script
function computeVAR(closes: number[], length: number): number[] {
  const valpha = 2 / (length + 1);

  // Precompute vud1 and vdd1 for each bar
  const vud1: number[] = [0];
  const vdd1: number[] = [0];
  for (let i = 1; i < closes.length; i++) {
    vud1.push(closes[i] > closes[i - 1] ? closes[i] - closes[i - 1] : 0);
    vdd1.push(closes[i] < closes[i - 1] ? closes[i - 1] - closes[i] : 0);
  }

  const VAR: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    // sum(vud1, 9) and sum(vdd1, 9) — rolling 9-bar window
    let vUD = 0, vDD = 0;
    for (let j = Math.max(0, i - 8); j <= i; j++) {
      vUD += vud1[j];
      vDD += vdd1[j];
    }
    const vCMO = (vUD + vDD) !== 0 ? (vUD - vDD) / (vUD + vDD) : 0;
    const prevVAR = i > 0 ? VAR[i - 1] : 0; // nz(VAR[1]) = 0 at bar 0
    VAR.push(valpha * Math.abs(vCMO) * closes[i] + (1 - valpha * Math.abs(vCMO)) * prevVAR);
  }
  return VAR;
}

Deno.serve(async (_req) => {
  try {
    // 1. Grab watchlist with existing OTT state for change detection
    const { data: stocks, error: stocksError } = await supabase
      .from('stocks_list')
      .select('ticker, algo_ott');

    if (stocksError || !stocks) throw new Error('Could not fetch watchlist.');

    const executionSummary = [];

    for (const stock of stocks) {
      const ticker = stock.ticker;

      // 2. Fetch latest 100 candles descending, then reverse for chronological order
      const { data: candlesDesc, error: candleError } = await supabase
        .from('stock_candles')
        .select('close, candle_date')
        .eq('ticker', ticker)
        .order('candle_date', { ascending: false })
        .limit(100);

      if (candleError || !candlesDesc || candlesDesc.length < 10) continue;

      const candles = candlesDesc.reverse();
      const total = candles.length;
      const closes = candles.map(c => Number(c.close));

      // 3. Compute VAR (MAvg)
      const MAvg = computeVAR(closes, OTT_LENGTH);

      // 4. Compute OTT stops and direction — nz() seeded from bar 0
      let longStopPrev = MAvg[0] - MAvg[0] * OTT_PERCENT * 0.01;
      let shortStopPrev = MAvg[0] + MAvg[0] * OTT_PERCENT * 0.01;
      let dir = 1;

      const OTT: number[] = [];

      // Bar 0 seed
      const mt0 = dir === 1 ? longStopPrev : shortStopPrev;
      OTT.push(MAvg[0] > mt0 ? mt0 * (200 + OTT_PERCENT) / 200 : mt0 * (200 - OTT_PERCENT) / 200);

      for (let i = 1; i < total; i++) {
        const fark = MAvg[i] * OTT_PERCENT * 0.01;

        const longStopRaw = MAvg[i] - fark;
        const longStop = MAvg[i] > longStopPrev ? Math.max(longStopRaw, longStopPrev) : longStopRaw;

        const shortStopRaw = MAvg[i] + fark;
        const shortStop = MAvg[i] < shortStopPrev ? Math.min(shortStopRaw, shortStopPrev) : shortStopRaw;

        // dir: matches Pine's nz(dir[1], dir) ratchet logic
        dir = (dir === -1 && MAvg[i] > shortStopPrev) ? 1
            : (dir === 1  && MAvg[i] < longStopPrev)  ? -1 : dir;

        longStopPrev  = longStop;
        shortStopPrev = shortStop;

        const mt = dir === 1 ? longStop : shortStop;
        OTT.push(MAvg[i] > mt ? mt * (200 + OTT_PERCENT) / 200 : mt * (200 - OTT_PERCENT) / 200);
      }

      // 5. Determine marketState from final dir
      const marketState = dir === 1 ? 'BULLISH' : 'BEARISH';

      // 6. currentSignal: continuous comparison of MAvg vs OTT[2] (matches TradingView display)
      //    BUY  = MAvg currently above the 2-bar delayed OTT line
      //    SELL = MAvg currently below it
      let currentSignal = 'HOLD';
      if (total >= 3) {
        const i = total - 1;
        currentSignal = MAvg[i] > OTT[i - 2] ? 'BUY' : 'SELL';
      }

      // 7. Detect currentSignal change and log to signal_changes
      const oldSignal = stock.algo_ott?.currentSignal || null;
      if (oldSignal && oldSignal !== currentSignal && currentSignal !== 'HOLD') {
        await supabase.from('signal_changes').insert({
          ticker,
          indicator: 'ott',
          old_value: oldSignal,
          new_value: currentSignal,
        });
        console.log(`[signal-change] OTT ${ticker}: ${oldSignal} → ${currentSignal}`);
      }

      // 8. Write result back to stocks_list
      await supabase.from('stocks_list')
        .update({
          algo_ott: {
            marketState,
            currentSignal,
            mavg: Math.round(MAvg[total - 1] * 100) / 100,
            ott:  Math.round(OTT[total - 3] * 100) / 100, // OTT[2] for display
            asOf: candles[total - 1].candle_date,
            updatedAt: new Date().toISOString(),
          }
        })
        .eq('ticker', ticker);

      executionSummary.push({ ticker, status: 'Analyzed', changed: oldSignal !== currentSignal });
    }

    return new Response(JSON.stringify({ success: true, processed: executionSummary }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
