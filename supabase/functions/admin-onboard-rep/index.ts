// Edge Function: admin-onboard-rep
// Admin-only. Creates a rep auth user + profile, sends a magic link.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.0";

interface OnboardBody {
    email: string;
    display_name: string;
    phone?: string;
}

Deno.serve(async (req) => {
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response("Unauthorized", { status: 401 });

    let body: OnboardBody;
    try {
        body = await req.json();
    } catch {
        return new Response("Bad request", { status: 400 });
    }
    if (!body.email || !body.display_name) {
        return new Response("Missing required fields", { status: 400 });
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
    const { data: caller } = await svc
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
    if (!caller || caller.role !== "admin") return new Response("Forbidden", { status: 403 });

    // Invite via magic link — creates auth user if absent.
    const { data: invited, error: inviteErr } = await svc.auth.admin.inviteUserByEmail(body.email);
    if (inviteErr || !invited.user) {
        return new Response(JSON.stringify({ error: "invite_failed", detail: inviteErr?.message }), {
            status: 500,
            headers: { "content-type": "application/json" },
        });
    }

    const { error: profileErr } = await svc.from("profiles").insert({
        id: invited.user.id,
        role: "rep",
        status: "pending",
        display_name: body.display_name,
        email: body.email,
        phone: body.phone,
        created_by: user.id,
    });
    if (profileErr) {
        return new Response(JSON.stringify({ error: "profile_failed", detail: profileErr.message }), {
            status: 500,
            headers: { "content-type": "application/json" },
        });
    }

    return new Response(JSON.stringify({ ok: true, user_id: invited.user.id }), {
        status: 200,
        headers: { "content-type": "application/json" },
    });
});
