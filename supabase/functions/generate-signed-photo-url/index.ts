// Edge Function: generate-signed-photo-url
// Re-checks RLS predicate, then issues a 60-second signed URL for a wound photo.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.0";

Deno.serve(async (req) => {
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response("Unauthorized", { status: 401 });

    let body: { photo_id?: string };
    try {
        body = await req.json();
    } catch {
        return new Response("Bad request", { status: 400 });
    }
    if (!body.photo_id) return new Response("Missing photo_id", { status: 400 });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    // Use the user's JWT so RLS naturally filters the photo lookup.
    const userClient = createClient(
        supabaseUrl,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
    );

    const { data: photo, error } = await userClient
        .from("wound_photos")
        .select("id, storage_path, visit_id")
        .eq("id", body.photo_id)
        .maybeSingle();

    if (error || !photo) {
        // RLS will return no rows for unauthorized callers — same response either way.
        return new Response(JSON.stringify({ error: "not_found_or_forbidden" }), {
            status: 404,
            headers: { "content-type": "application/json" },
        });
    }

    // Service role to sign the URL (signing is privileged).
    const svc = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: signed, error: signErr } = await svc.storage
        .from("wound-photos")
        .createSignedUrl(photo.storage_path, 60);

    if (signErr || !signed) {
        return new Response(JSON.stringify({ error: "sign_failed" }), { status: 500 });
    }

    // Audit the access.
    const { data: { user } } = await userClient.auth.getUser();
    if (user) {
        await svc.from("audit_log").insert({
            actor_id: user.id,
            action: "photo_viewed",
            entity_table: "wound_photos",
            entity_id: photo.id,
            metadata: { visit_id: photo.visit_id },
        });
    }

    return new Response(JSON.stringify({ url: signed.signedUrl, expires_in: 60 }), {
        status: 200,
        headers: { "content-type": "application/json" },
    });
});
