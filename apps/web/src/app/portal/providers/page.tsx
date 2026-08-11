import Link from "next/link";
import { requirePortalUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { InviteProvider } from "./InviteProvider";
import { ProvidersTable, type ProviderRow } from "./ProvidersTable";
import { HOUSE_ACCOUNT_OWNER_ID } from "@/lib/house-account";

export default async function ProvidersPage() {
  const user = await requirePortalUser();
  const supabase = await createClient();

  const { data: providers } = await supabase
    .from("providers")
    .select("id, practice_name, city, state, provider_first, provider_last, credentials, mednecessity_status, approved, active, individual_npi, rep_id, profiles:rep_id(display_name, role)")
    .is("deleted_at", null)
    .order("practice_name");

  // Latest touch point per provider for the list (RLS-scoped: admins all, reps own).
  const ids = (providers ?? []).map((p) => p.id);
  const lastTouch = new Map<string, { kind: string; at: string }>();
  if (ids.length > 0) {
    const { data: tps } = await supabase
      .from("provider_touchpoints")
      .select("provider_id, kind, occurred_at")
      .in("provider_id", ids)
      .order("occurred_at", { ascending: false });
    for (const t of tps ?? []) {
      if (!lastTouch.has(t.provider_id)) lastTouch.set(t.provider_id, { kind: t.kind, at: t.occurred_at });
    }
  }

  const rows: ProviderRow[] = (providers ?? []).map((p) => {
    const owner = p.profiles as unknown as { display_name: string; role: string } | null;
    const isHouse = p.rep_id === HOUSE_ACCOUNT_OWNER_ID;
    return {
      id: p.id,
      practice_name: p.practice_name,
      city: p.city,
      state: p.state,
      provider_first: p.provider_first,
      provider_last: p.provider_last,
      credentials: p.credentials,
      mednecessity_status: p.mednecessity_status,
      approved: p.approved,
      active: p.active !== false,
      rep_id: p.rep_id,
      repName: isHouse ? "House account" : (owner?.display_name ?? "—"),
      isHouse,
      npiMissing: !p.individual_npi || /^0+$/.test(p.individual_npi),
      lastTouchKind: lastTouch.get(p.id)?.kind ?? null,
      lastTouchAt: lastTouch.get(p.id)?.at ?? null,
    };
  });

  return (
    <div className="space-y-6">
      <div className="relative flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy-900">Providers</h1>
        <div className="flex items-center gap-2">
          <InviteProvider />
          <Link
            href="/portal/providers/new"
            className="btn-brand rounded-lg px-3 py-2 text-sm font-semibold text-white"
          >
            + Register provider
          </Link>
        </div>
      </div>

      <ProvidersTable providers={rows} isAdmin={user.role === "admin"} />

      <p className="text-xs text-slate-400">
        Providers must be approved by Agile and onboarded with MedNecessity before orders can be
        placed.
      </p>
    </div>
  );
}
