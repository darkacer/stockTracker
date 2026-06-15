import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const ticker = url.searchParams.get("ticker")?.toUpperCase();

    if (!ticker) {
      return new Response(JSON.stringify({ error: "ticker param required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const candidates = ticker.includes(".")
      ? [ticker]
      : [ticker, `${ticker}.NS`, `${ticker}.BO`];

    for (const candidate of candidates) {
      const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(candidate)}?interval=1d&range=1d`;
      const response = await fetch(yahooUrl);
      const data = await response.json();

      if (data.chart?.result?.length > 0) {
        const meta = data.chart.result[0].meta;
        if (meta.regularMarketPrice) {
          return new Response(
            JSON.stringify({
              ticker: meta.symbol,
              name: meta.longName || meta.shortName || candidate,
              price: meta.regularMarketPrice,
              currency: meta.currency || "USD",
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    return new Response(JSON.stringify({ error: "Ticker not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Lookup failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
