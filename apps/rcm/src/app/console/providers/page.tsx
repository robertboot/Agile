import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { NewProvider } from "./forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Providers" };

interface ProviderRow {
  id: string;
  individual_npi: string;
  first_name: string;
  last_name: string;
  credentials: string | null;
  medicare_enrollment_status: string;
  medicare_ptan: string | null;
}

interface CaseLink {
  provider_id: string;
  case_file: { id: string; service_line: string; status: string; title: string } | null;
}

const MEDICARE_LABEL: Record<string, string> = {
  enrolled: "Medicare enrolled",
  not_enrolled: "Not Medicare enrolled",
  unknown: "Medicare status unchecked",
};

const MEDICARE_STYLE: Record<string, string> = {
  enrolled: "bg-emerald-100 text-emerald-800",
  not_enrolled: "bg-slate-100 text-slate-600",
  unknown: "bg-amber-100 text-amber-800",
};

export default async function ProvidersPage() {
  await requireStaff();
  const db = createAdminClient().schema("credentialing");

  // Two queries rather than one embed: the counts we want are per service
  // line, and a nested count cannot be grouped.
  const [{ data: providers }, { data: links }] = await Promise.all([
    db
      .from("provider")
      .select("id, individual_npi, first_name, last_name, credentials, medicare_enrollment_status, medicare_ptan")
      .is("deleted_at", null)
      .order("last_name"),
    db
      .from("case_provider")
      .select("provider_id, case_file(id, service_line, status, title)"),
  ]);

  const rows = (providers ?? []) as ProviderRow[];
  const caseLinks = (links ?? []) as unknown as CaseLink[];

  const work = new Map<string, { credentialing: number; appeals: number }>();
  for (const link of caseLinks) {
    const c = link.case_file;
    if (!c || c.status === "closed") continue;
    const entry = work.get(link.provider_id) ?? { credentialing: 0, appeals: 0 };
    if (c.service_line === "appeals") entry.appeals += 1;
    else entry.credentialing += 1;
    work.set(link.provider_id, entry);
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-credence-navy">Providers</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            The roster. Every provider is entered once here and linked from the cases
            that concern them — so a provider who picks up a second service is never
            re-keyed, and a corrected NPI is corrected everywhere.
          </p>
        </div>
        <NewProvider />
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-credence-line px-5 py-10 text-sm text-slate-500">
          No providers yet. Add the first one above.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-credence-line">
          <table className="w-full text-left text-sm">
            <thead className="bg-credence-paper">
              <tr className="text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 font-semibold">Provider</th>
                <th className="px-4 py-3 font-semibold">NPI</th>
                <th className="px-4 py-3 font-semibold">Medicare</th>
                <th className="px-4 py-3 font-semibold">Open work</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-credence-line">
              {rows.map((p) => {
                const w = work.get(p.id);
                return (
                  <tr key={p.id}>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-credence-navy">
                        {p.first_name} {p.last_name}
                      </span>
                      {p.credentials && (
                        <span className="ml-1.5 text-slate-500">{p.credentials}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">
                      {p.individual_npi}
                      {p.medicare_ptan && (
                        <span className="ml-2 text-slate-400">PTAN {p.medicare_ptan}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block whitespace-nowrap rounded px-2 py-0.5 text-xs font-semibold ${
                          MEDICARE_STYLE[p.medicare_enrollment_status] ?? "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {MEDICARE_LABEL[p.medicare_enrollment_status] ?? p.medicare_enrollment_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {!w ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <span className="flex flex-wrap gap-x-3 gap-y-1">
                          {w.credentialing > 0 && (
                            <span>
                              {w.credentialing} credentialing
                            </span>
                          )}
                          {w.appeals > 0 && (
                            <Link href="/console/appeals" className="text-credence-navy underline underline-offset-4">
                              {w.appeals} appeal{w.appeals === 1 ? "" : "s"}
                            </Link>
                          )}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
