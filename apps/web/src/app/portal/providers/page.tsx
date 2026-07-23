import Link from "next/link";
import { requirePortalUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { InviteProvider } from "./InviteProvider";

const MN_LABELS: Record<string, string> = {
  awaiting: "Awaiting approval",
  sent: "Sent to MedNecessity",
  onboarded: "Onboarded",
};

const MN_COLORS: Record<string, string> = {
  awaiting: "bg-amber-100 text-amber-800",
  sent: "bg-blue-100 text-blue-800",
  onboarded: "bg-emerald-100 text-emerald-800",
};

export default async function ProvidersPage() {
  const user = await requirePortalUser();
  const supabase = await createClient();

  const query = supabase
    .from("providers")
    .select("id, practice_name, city, state, provider_first, provider_last, credentials, approved, mednecessity_status, rep_id, profiles:rep_id(display_name)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const { data: providers } = await query;

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

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Practice</th>
              <th className="px-4 py-2.5 font-medium">Rendering provider</th>
              <th className="px-4 py-2.5 font-medium">Location</th>
              {user.role === "admin" && <th className="px-4 py-2.5 font-medium">Rep</th>}
              <th className="px-4 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {(providers ?? []).map((p) => (
              <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-2.5">
                  <Link
                    href={`/portal/providers/${p.id}`}
                    className="font-medium text-navy-900 hover:text-brand-blue hover:underline"
                  >
                    {p.practice_name}
                  </Link>
                </td>
                <td className="px-4 py-2.5">
                  {p.provider_first} {p.provider_last}
                  {p.credentials ? `, ${p.credentials}` : ""}
                </td>
                <td className="px-4 py-2.5">
                  {p.city}, {p.state}
                </td>
                {user.role === "admin" && (
                  <td className="px-4 py-2.5">
                    {(p.profiles as unknown as { display_name: string })?.display_name ?? "—"}
                  </td>
                )}
                <td className="px-4 py-2.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${MN_COLORS[p.mednecessity_status]}`}
                  >
                    {MN_LABELS[p.mednecessity_status]}
                  </span>
                </td>
              </tr>
            ))}
            {(providers ?? []).length === 0 && (
              <tr>
                <td colSpan={user.role === "admin" ? 5 : 4} className="px-4 py-8 text-center text-slate-400">
                  No providers yet. Register your first clinic to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400">
        Providers must be approved by Agile and onboarded with MedNecessity before orders can be
        placed.
      </p>
    </div>
  );
}
