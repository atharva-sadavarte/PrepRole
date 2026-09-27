import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Verify Webhook Secret (if configured)
    const expectedAuth = Deno.env.get("REVENUECAT_WEBHOOK_AUTH");
    if (expectedAuth) {
      const authHeader = req.headers.get("Authorization");
      if (authHeader !== `Bearer ${expectedAuth}`) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const payload = await req.json();
    const event = payload?.event;

    if (!event) {
      return new Response(JSON.stringify({ error: "Missing event payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const appUserId = event.app_user_id;
    const eventType = event.type;
    const productId = event.product_id || "";
    const expirationMs = event.expiration_at_ms;

    if (!appUserId) {
      return new Response(JSON.stringify({ error: "Missing app_user_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    console.log(`Processing RevenueCat event: ${eventType} for user: ${appUserId} (${productId})`);

    // Handle Subscription events
    if (eventType === "INITIAL_PURCHASE" || eventType === "RENEWAL") {
      const proUntil = expirationMs ? new Date(expirationMs).toISOString() : null;
      await supabaseAdmin
        .from("user_quotas")
        .upsert({
          user_id: appUserId,
          plan_type: "pro",
          pro_until: proUntil,
          updated_at: new Date().toISOString(),
        });
    } else if (eventType === "EXPIRATION") {
      await supabaseAdmin
        .from("user_quotas")
        .update({
          plan_type: "free",
          pro_until: null,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", appUserId);
    } else if (eventType === "NON_RENEWING_PURCHASE") {
      // One-time credit packs (e.g. 5 scans)
      const creditsToAdd = productId.includes("5") ? 5 : 3;

      // Increment atomically
      const { data: currentQuota } = await supabaseAdmin
        .from("user_quotas")
        .select("credits_remaining")
        .eq("user_id", appUserId)
        .single();

      const newCredits = (currentQuota?.credits_remaining || 0) + creditsToAdd;

      await supabaseAdmin
        .from("user_quotas")
        .upsert({
          user_id: appUserId,
          credits_remaining: newCredits,
          updated_at: new Date().toISOString(),
        });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Webhook processing error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
