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
    const currency = url.searchParams.get("currency")?.toUpperCase();

    if (!currency || currency === "INR") {
      return new Response(JSON.stringify({ currency: "INR", rate: 1 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pair = `${currency}INR=X`;
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${pair}?interval=1d&range=1d`;
    const response = await fetch(yahooUrl);
    const data = await response.json();
    const rate = data.chart?.result?.[0]?.meta?.regularMarketPrice;

    return new Response(
      JSON.stringify({ currency, rate: rate || 1 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch {
    return new Response(JSON.stringify({ currency: "USD", rate: 1 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
