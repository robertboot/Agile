import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Persistent, cross-instance rate limiter backed by fn_rate_limit in Postgres
// (audit M1 — the previous in-memory Map reset per serverless instance, so the
// effective ceiling was N×). Fixed window; returns true if the hit is allowed.
// Fails OPEN on a DB error so a transient outage never locks users out.
export async function rateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number,
): Promise<boolean> {
  try {
    const db = createAdminClient();
    const { data, error } = await db.rpc("fn_rate_limit", {
      p_key: key,
      p_max: maxAttempts,
      p_window_seconds: Math.ceil(windowMs / 1000),
    });
    if (error) return true;
    return data !== false;
  } catch {
    return true;
  }
}
