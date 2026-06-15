import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.0'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const ticker = url.searchParams.get('ticker')?.toUpperCase();

    if (!ticker) {
      return new Response(JSON.stringify({ error: "Missing 'ticker' parameter" }), { 
        status: 400, 
        headers: { "Content-Type": "application/json" } 
      });
    }

    // Single record read targeting our new JSONB caching field
    const { data, error } = await supabase
      .from('stocks_list')
      .select('ticker, algo_chandelier_exit')
      .eq('ticker', ticker)
      .single();

    if (error || !data) {
      return new Response(JSON.stringify({ error: `Ticker ${ticker} not tracked in watchlist.` }), { 
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Extract the stored JSON data
    const analytics = data.algo_chandelier_exit || {};

    return new Response(JSON.stringify({
      ticker: data.ticker,
      marketState: analytics.marketState ?? "UNKNOWN",
      currentSignal: analytics.currentSignal ?? "NO_DATA",
      asOf: analytics.asOf ?? null,
      calculatedAt: analytics.updatedAt ?? null
    }), {
      headers: { "Content-Type": "application/json" },
      status: 200
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});