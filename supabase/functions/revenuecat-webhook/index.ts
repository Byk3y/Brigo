import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
    // 1. Basic security check (Optional: verify RC header if you set one)
    // const authHeader = req.headers.get('Authorization');
    // if (authHeader !== `Bearer ${Deno.env.get('REVENUECAT_WEBHOOK_SECRET')}`) {
    //   return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    // }

    try {
        const { event } = await req.json();
        const { type, app_user_id, expiration_at_ms, entitlement_ids } = event;

        console.log(`RC Webhook received: ${type} for user: ${app_user_id}`);

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Map RevenueCat events to our Supabase schema
        let updates: any = {
            updated_at: new Date().toISOString(),
        };

        if (expiration_at_ms) {
            updates.current_period_end = new Date(expiration_at_ms).toISOString();
        }

        switch (type) {
            case "INITIAL_PURCHASE":
            case "RENEWAL":
            case "UNCANCELLATION":
            case "SUBSCRIPTION_EXTENDED":
                updates.tier = "premium";
                updates.status = "active";
                break;

            case "CANCELLATION":
                // In RC, CANCELLATION means auto-renew turned off.
                // User still has access until expiration.
                updates.status = "canceled";
                break;

            case "EXPIRATION":
                updates.tier = "free";
                updates.status = "expired";
                break;

            case "BILLING_ISSUE":
                // Keep tier, but maybe mark status as billing_issue or expired
                updates.status = "expired";
                break;

            default:
                console.log(`Unhandled event type: ${type}`);
                return new Response(JSON.stringify({ message: "Event ignored" }), { status: 200 });
        }

        // Fetch existing subscription to check current state
        const { data: existingSub } = await supabase
            .from("user_subscriptions")
            .select("tier, status")
            .eq("user_id", app_user_id)
            .single();

        // Log current state for debugging
        if (existingSub) {
            console.log(`Current subscription state for ${app_user_id}: tier=${existingSub.tier}, status=${existingSub.status}`);
        }

        // Update the record
        const { error } = await supabase
            .from("user_subscriptions")
            .update(updates)
            .eq("user_id", app_user_id);

        if (error) {
            console.error("Error updating subscription in DB:", error);
            return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }

        return new Response(JSON.stringify({ message: "Success" }), { status: 200 });
    } catch (err) {
        console.error("Webhook processing failed:", err);
        return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
    }
});
