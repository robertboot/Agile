// Edge Function: redeem-invite-code
// Called during provider signup or by an existing provider to bind to a rep.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.0";

Deno.serve(async (req) => {
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response("Unauthorized", { status: 401 });

    let body: { code?: string };
    try {
        body = await req.json();
    } catch {
        return new Response("Bad request", { status: 400 });
    }
    const code = body.code?.toUpperCase().trim();
    if (!code || !/^[A-Z2-9]{6}$/.test(code)) {
        return new Response(JSON.stringify({ error: "invalid_code_format" }), {
            status: 400,
            headers: { "content-type": "application/json" },
        });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(
        supabaseUrl,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return new Response("Unauthorized", { status: 401 });

    const svc = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Caller must be a provider (or no profile yet — treat as new provider).
    const { data: profile } = await svc
        .from("profiles")
        .select("id, role, status")
        .eq("id", user.id)
        .maybeSingle();

    if (profile && profile.role !== "provider") {
        return new Response(JSON.stringify({ error: "only_providers_redeem" }), {
            status: 403,
            headers: { "content-type": "application/json" },
        });
    }

    const { data: invite } = await svc
        .from("invite_codes")
        .select("id, rep_id, max_uses, uses, expires_at, revoked_at")
        .eq("code", code)
        .maybeSingle();

    if (!invite) {
        return new Response(JSON.stringify({ error: "code_not_found" }), {
            status: 404,
            headers: { "content-type": "application/json" },
        });
    }
    if (invite.revoked_at) {
        return new Response(JSON.stringify({ error: "code_revoked" }), { status: 410 });
    }
    if (new Date(invite.expires_at) < new Date()) {
        return new Response(JSON.stringify({ error: "code_expired" }), { status: 410 });
    }
    if (invite.uses >= invite.max_uses) {
        return new Response(JSON.stringify({ error: "code_exhausted" }), { status: 410 });
    }

    // Upsert assignment + bump uses atomically via a single RPC would be ideal;
    // for v1 we accept the small race window and rely on the unique index.
    const { error: assignErr } = await svc
        .from("rep_provider_assignments")
        .insert({
            rep_id: invite.rep_id,
            provider_id: user.id,
            assigned_by: invite.rep_id,
            source: "invite_code",
            active: true,
        });
    if (assignErr && !assignErr.message.includes("duplicate")) {
        return new Response(JSON.stringify({ error: "assignment_failed", detail: assignErr.message }), {
            status: 500,
            headers: { "content-type": "application/json" },
        });
    }

    await svc.from("invite_codes").update({ uses: invite.uses + 1 }).eq("id", invite.id);

    // Activate the provider if they were pending.
    if (profile && profile.status === "pending") {
        await svc.from("profiles").update({ status: "active" }).eq("id", user.id);
    }

    return new Response(JSON.stringify({ ok: true, rep_id: invite.rep_id }), {
        status: 200,
        headers: { "content-type": "application/json" },
    });
});
