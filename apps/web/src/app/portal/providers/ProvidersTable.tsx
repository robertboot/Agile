"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

export interface ProviderRow {
  id: string;
  practice_name: string;
  city: string | null;
  state: string | null;
  provider_first: string;
  provider_last: string;
  credentials: string | null;
  mednecessity_status: string;
  rep_id: string;
  repName: string;
  isHouse: boolean;
  npiMissing: boolean;
}

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

type SortKey = "practice" | "provider" | "location" | "rep" | "status";

export function ProvidersTable({
  providers,
  isAdmin,
}: {
  providers: ProviderRow[];
  isAdmin: boolean;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("practice");
  const [asc, setAsc] = useState(true);
  const [query, setQuery] = useState("");
  const [owner, setOwner] = useState("all");

  const owners = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of providers) m.set(p.rep_id, p.repName);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [providers]);

  const rows = useMemo(() => {
    const val = (p: ProviderRow) => {
      switch (sortKey) {
        case "provider": return `${p.provider_last} ${p.provider_first}`;
        case "location": return `${p.state ?? ""} ${p.city ?? ""}`;
        case "rep": return p.repName;
        case "status": return p.mednecessity_status;
        default: return p.practice_name;
      }
    };
    const q = query.trim().toLowerCase();
    return providers
      .filter((p) => owner === "all" || p.rep_id === owner)
      .filter(
        (p) =>
          !q ||
          p.practice_name.toLowerCase().includes(q) ||
          `${p.provider_first} ${p.provider_last}`.toLowerCase().includes(q) ||
          (p.city ?? "").toLowerCase().includes(q) ||
          (p.state ?? "").toLowerCase().includes(q),
      )
      .sort((a, b) => val(a).localeCompare(val(b)) * (asc ? 1 : -1));
  }, [providers, sortKey, asc, query, owner]);

  function toggle(key: SortKey) {
    if (key === sortKey) setAsc((v) => !v);
    else {
      setSortKey(key);
      setAsc(true);
    }
  }

  const arrow = (key: SortKey) => (sortKey === key ? (asc ? " ▲" : " ▼") : "");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search practice, provider, city…"
          className="w-64 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-blue"
        />
        {isAdmin && owners.length > 1 && (
          <select
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-blue"
          >
            <option value="all">All reps</option>
            {owners.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        )}
        <span className="text-xs text-slate-400">{rows.length} shown</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 text-left text-slate-500">
            <tr>
              <Th label={`Practice${arrow("practice")}`} onClick={() => toggle("practice")} />
              <Th label={`Rendering provider${arrow("provider")}`} onClick={() => toggle("provider")} />
              <Th label={`Location${arrow("location")}`} onClick={() => toggle("location")} />
              {isAdmin && <Th label={`Rep${arrow("rep")}`} onClick={() => toggle("rep")} />}
              <Th label={`Status${arrow("status")}`} onClick={() => toggle("status")} />
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-2.5">
                  <Link
                    href={`/portal/providers/${p.id}`}
                    className="font-medium text-navy-900 hover:text-brand-blue hover:underline"
                  >
                    {p.practice_name}
                  </Link>
                  {p.npiMissing && (
                    <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">
                      NPI needed
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  {p.provider_first} {p.provider_last}
                  {p.credentials ? `, ${p.credentials}` : ""}
                </td>
                <td className="px-4 py-2.5">
                  {p.city}, {p.state}
                </td>
                {isAdmin && (
                  <td className="px-4 py-2.5">
                    {p.isHouse ? (
                      <span className="text-slate-500">House account</span>
                    ) : (
                      <Link href={`/portal/admin/reps/${p.rep_id}`} className="text-brand-blue hover:underline">
                        {p.repName}
                      </Link>
                    )}
                  </td>
                )}
                <td className="px-4 py-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${MN_COLORS[p.mednecessity_status]}`}>
                    {MN_LABELS[p.mednecessity_status]}
                  </span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 5 : 4} className="px-4 py-8 text-center text-slate-400">
                  No providers match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <th className="px-4 py-2.5 font-medium">
      <button type="button" onClick={onClick} className="hover:text-navy-900">
        {label}
      </button>
    </th>
  );
}
