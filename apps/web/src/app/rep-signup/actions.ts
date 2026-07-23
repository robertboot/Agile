"use server";

// Public rep signup via admin invite: e-sign the Sales Representative
// Agreement, set a password, and the rep account is created active.

import { createAdminClient } from "@/lib/supabase/admin";
import { notifySlack } from "@/lib/integrations/slack";
import { rateLimit } from "@/lib/rate-limit";

export interface RepSignupResult {
  ok: boolean;
  error?: string;
}

export async function submitRepSignup(
  token: string,
  _prev: RepSignupResult | null,
  formData: FormData,
): Promise<RepSignupResult> {
  if (!/^[0-9a-f-]{36}$/.test(token)) return { ok: false, error: "Invalid signup link." };
  if (!rateLimit(`rep-signup:${token}`, 10, 15 * 60 * 1000)) {
    return { ok: false, error: "Too many attempts — try again shortly." };
  }

  const db = createAdminClient();
  const { data: invite } = await db
    .from("rep_invites")
    .select("id, email, invited_name, territory, status, expires_at")
    .eq("id", token)
    .maybeSingle();
  if (!invite || invite.status !== "pending") {
    return { ok: false, error: "This signup link is no longer valid." };
  }
  if (new Date(invite.expires_at) < new Date()) {
    await db.from("rep_invites").update({ status: "expired" }).eq("id", token);
    return { ok: false, error: "This signup link has expired — ask Agile for a new one." };
  }

  const f = (k: string) => (formData.get(k) as string | null)?.trim() || null;
  const displayName = f("display_name");
  const phone = f("phone");
  const password = formData.get("password") as string | null;
  const confirm = formData.get("password_confirm") as string | null;
  const signature = f("signature");

  if (!displayName) return { ok: false, error: "Your full name is required." };
  if (!password || password.length < 10) {
    return { ok: false, error: "Choose a password of at least 10 characters." };
  }
  if (password !== confirm) return { ok: false, error: "Passwords don't match." };
  if (formData.get("contract_accept") !== "on") {
    return { ok: false, error: "Please review and accept the Sales Representative Agreement." };
  }
  if (!signature) return { ok: false, error: "Type your full legal name as your signature." };

  const { data: created, error: authError } = await db.auth.admin.createUser({
    email: invite.email,
    password,
    email_confirm: true,
  });
  if (authError || !created.user) {
    return {
      ok: false,
      error: authError?.message.includes("already")
        ? "An account already exists for this email — contact Agile."
        : `Account creation failed: ${authError?.message ?? "unknown error"}`,
    };
  }

  const now = new Date().toISOString();
  const { error: profileError } = await db.from("profiles").insert({
    id: created.user.id,
    role: "rep",
    status: "active",
    display_name: displayName,
    email: invite.email,
    phone,
  });
  if (profileError) return { ok: false, error: profileError.message };

  const { error: detailsError } = await db.from("rep_details").insert({
    profile_id: created.user.id,
    territory: invite.territory,
    contract_accepted_at: now,
    contract_signatory: signature,
  });
  if (detailsError) return { ok: false, error: detailsError.message };

  await db
    .from("rep_invites")
    .update({ status: "completed", completed_profile_id: created.user.id, completed_at: now })
    .eq("id", token);

  await notifySlack({
    kind: "provider_registered", // reuse channel; message text below
    practice: `New rep signed: ${displayName} (${invite.territory ?? "no territory"})`,
    rep: "rep onboarding",
  });

  return { ok: true };
}
