import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client — bypasses RLS. Server-only.
 *
 * Every credentialing read and write goes through this, behind requireStaff().
 * Authorization is enforced in the app layer rather than by RLS on the caller's
 * own JWT, because credentialing rows are not yet reachable by the people they
 * describe: DESIGN-CORRECTIONS §5.3/§5.4 walls provider-private data off from
 * the billing party, and that consent model is not designed. Until it is, the
 * only reader is a staff member, and a staff member may read everything.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
