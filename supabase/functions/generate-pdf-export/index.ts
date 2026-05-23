// Edge Function: generate-pdf-export
// Renders the wound documentation PDF (used by mobile app online path and Phase 2 portal).
// SKELETON — actual rendering via pdf-lib needs the template implementation
// in /packages/pdf-template once that package lands.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.0";

Deno.serve(async (req) => {
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response("Unauthorized", { status: 401 });

    let body: { wound_id?: string; visit_ids?: string[] };
    try {
        body = await req.json();
    } catch {
        return new Response("Bad request", { status: 400 });
    }
    if (!body.wound_id) return new Response("Missing wound_id", { status: 400 });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(
        supabaseUrl,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
    );

    // RLS-filtered fetches — caller only sees what they're allowed to see.
    const { data: wound, error: woundErr } = await userClient
        .from("wounds")
        .select("*, patient:patients(*), visits:wound_visits(*, measurements:wound_measurements(*), photos:wound_photos(*))")
        .eq("id", body.wound_id)
        .maybeSingle();

    if (woundErr || !wound) {
        return new Response(JSON.stringify({ error: "not_found_or_forbidden" }), {
            status: 404,
            headers: { "content-type": "application/json" },
        });
    }

    // TODO: import renderer from /packages/pdf-template and produce a Uint8Array.
    // For now, return 501 so callers know to use the offline expo-print fallback.
    return new Response(
        JSON.stringify({
            error: "not_implemented",
            note: "PDF renderer wires in once packages/pdf-template lands. Use offline expo-print fallback meanwhile.",
        }),
        { status: 501, headers: { "content-type": "application/json" } },
    );
});
