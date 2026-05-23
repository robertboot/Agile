// Edge Function: issue-invite-code
// Rep-callable. Generates a 6-char code (no 0/O/1/I), rate-limited to 5/day per rep.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.0";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 32 chars, ambiguity-stripped

function generateCode(): string {
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    let out = "";
    for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
    return out;
}

Deno.serve(async (req) => {
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response("Unauthorized", { status: 401 });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Use anon key for the user-context call to identify the caller.
    const userClient = createClient(
        supabaseUrl,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return new Response("Unauthorized", { status: 401 });

    // Service client for privileged checks.
    const svc = createClient(supabaseUrl, serviceKey);

    const { data: profile } = await svc
        .from("profiles")
        .select("id, role, status")
        .eq("id", user.id)
        .single();

    if (!profile || profile.role !== "rep" || profile.status !== "active") {
        return new Response("Forbidden", { status: 403 });
    }

    // Rate limit: 5 codes per rep per rolling 24h.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await svc
        .from("invite_codes")
        .select("id", { count: "exact", head: true })
        .eq("rep_id", user.id)
        .gte("created_at", since);

    if ((count ?? 0) >= 5) {
        return new Response(JSON.stringify({ error: "rate_limited" }), {
            status: 429,
            headers: { "content-type": "application/json" },
        });
    }

    // Generate; retry on collision (extremely rare).
    for (let attempt = 0; attempt < 5; attempt++) {
        const code = generateCode();
        const { data, error } = await svc
            .from("invite_codes")
            .insert({ rep_id: user.id, code })
            .select("code, expires_at")
            .single();
        if (!error && data) {
            return new Response(JSON.stringify(data), {
                status: 200,
                headers: { "content-type": "application/json" },
            });
        }
    }

    return new Response("Could not allocate code", { status: 500 });
});
