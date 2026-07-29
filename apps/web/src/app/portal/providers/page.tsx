import Link from "next/link";
import { requirePortalUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { InviteProvider } from "./InviteProvider";
import { ProvidersTable, type ProviderRow } from "./ProvidersTable";

export default async function ProvidersPage() {
  const user = await requirePortalUser();
  const supabase = await createClient();

  const { data: providers } = await supabase
    .from("providers")
    .select("id, practice_name, city, state, provider_first, provider_last, credentials, mednecessity_status, individual_npi, rep_id, profiles:rep_id(display_name, role)")
    .is("deleted_at", null)
    .order("practice_name");

  const rows: ProviderRow[] = (providers ?? []).map((p) => {
    const owner = p.profiles as unknown as { display_name: string; role: string } | null;
    const isHouse = owner?.role === "admin";
    return {
      id: p.id,
      practice_name: p.practice_name,
      city: p.city,
      state: p.state,
      provider_first: p.provider_first,
      provider_last: p.provider_last,
      credentials: p.credentials,
      mednecessity_status: p.mednecessity_status,
      rep_id: p.rep_id,
      repName: isHouse ? "House account" : (owner?.display_name ?? "—"),
      isHouse,
      npiMissing: !p.individual_npi || /^0+$/.test(p.individual_npi),
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
