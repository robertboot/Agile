import Link from "next/link";
import { requirePortalUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { InviteProvider } from "./InviteProvider";
import { ProvidersTable, type ProviderRow } from "./ProvidersTable";
import { HOUSE_ACCOUNT_OWNER_ID } from "@/lib/house-account";

export default async function ProvidersPage() {
  const user = await requirePortalUser();
  const supabase = await createClient();

  const { data: providers } = await supabase
    .from("providers")
    .select("id, practice_name, city, state, provider_first, provider_last, credentials, mednecessity_status, approved, active, individual_npi, rep_id, profiles:rep_id(display_name, role), originator:originator_rep_id(display_name)")
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
      originatorName: (p.originator as unknown as { display_name: string } | null)?.display_name ?? null,
    };
  });

  // House-account profitability (admin only) — no rep commission; profit =
  // collected − actual product cost (stored COGS is the 2× buffer).
  let houseProfit: { orders: number; billed: number; collected: number; productCost: number; profit: number } | null = null;
  if (user.role === "admin") {
    const admin = createAdminClient();
    const { data: ho } = await admin
      .from("orders")
      .select("status, gross_collected_cents, order_internals(cogs_cents), order_items(billed_cents)")
      .eq("rep_id", HOUSE_ACCOUNT_OWNER_ID)
      .is("deleted_at", null)
      .is("prepurchase_account_id", null)
      .neq("status", "cancelled")
      .limit(5000);
    const hr = ho ?? [];
    const billed = hr.reduce((a, o) => a + (o.order_items as { billed_cents: number }[]).reduce((x, i) => x + i.billed_cents, 0), 0);
    const collected = hr.reduce((a, o) => a + Number(o.gross_collected_cents ?? 0), 0);
    const cogsBuffer = hr
      .filter((o) => ["shipped", "invoiced", "paid"].includes(o.status))
      .reduce((a, o) => a + Number((o.order_internals as unknown as { cogs_cents: number } | null)?.cogs_cents ?? 0), 0);
    const productCost = Math.round(cogsBuffer / 2);
    houseProfit = { orders: hr.length, billed, collected, productCost, profit: collected - productCost };
  }

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

      <ProvidersTable
        providers={rows}
        isAdmin={user.role === "admin"}
        houseOwnerId={HOUSE_ACCOUNT_OWNER_ID}
        houseProfit={houseProfit}
      />

      <p className="text-xs text-slate-400">
        Providers must be approved by Agile and onboarded with MedNecessity before orders can be
        placed.
      </p>
    </div>
  );
}
