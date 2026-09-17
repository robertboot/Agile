import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  DeclineEnrollment,
  NewLocation,
  NewProvider,
  OpenEnrollments,
} from "../forms";
import { BatchBuilder } from "./BatchBuilder";
import { embedded } from "../embedded";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  in_preparation: "In preparation",
  completeness_hold: "Completeness hold",
  submitted: "Submitted",
  additional_info_requested: "Info requested",
  approved: "In network",
  panel_closed: "Panel closed",
  declined_by_us: "Declined by us",
  denied_by_payer: "Denied",
  superseded: "Superseded",
  withdrawn: "Withdrawn",
};

export default async function OrganizationPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  await requireAdmin();
  const { orgId } = await params;
  const db = createAdminClient().schema("credentialing");

  const { data: org } = await db
    .from("organization")
    .select("id, legal_name, dba_name, ein, primary_organizational_npi")
    .eq("id", orgId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!org) notFound();

  const { data: locations } = await db
    .from("location")
    .select(
      "id, name, address_line1, city, state, postal_code, organizational_npi",
    )
    .eq("organization_id", orgId)
    .is("deleted_at", null)
    .order("name");

  const locationIds = (locations ?? []).map((l) => l.id as string);

  const [
    { data: engagements },
    { data: enrollments },
    { data: products },
    { data: groups },
  ] = await Promise.all([
    locationIds.length
      ? db
          .from("engagement")
          .select(
            "id, location_id, status, medicare_reassignment_status, provider:provider_id (id, first_name, last_name, individual_npi, credentials, medicare_enrollment_status)",
          )
          .in("location_id", locationIds)
          .is("deleted_at", null)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    db
      .from("v_enrollment_detail")
      .select(
        "id, location, provider, payer_group, payer_product, status, disposition, effective_date, submission_batch_id",
      )
      .eq("organization_id", orgId)
      .order("payer_group"),
    db
      .from("payer_product")
      .select(
        "id, name, credentialing_subject, payer_group:payer_group_id (name)",
      )
      .eq("credentialing_requirement", "required")
      .is("deleted_at", null)
      .order("name"),
    db
      .from("payer_group")
      .select("id, name")
      .is("deleted_at", null)
      .order("name"),
  ]);

  const locationLabel = (l: Record<string, unknown>) =>
    (l.name as string | null) ??
    `${l.address_line1 as string}, ${l.city as string}`;

  const locationOptions = (locations ?? []).map((l) => ({
    id: l.id as string,
    label: locationLabel(l),
  }));

  const providerOptions = (engagements ?? []).flatMap((e) => {
    const p = embedded(e.provider);
    if (!p) return [];
    return [{ id: p.id as string, label: `${p.first_name} ${p.last_name}` }];
  });

  const productOptions = (products ?? []).map((p) => ({
    id: p.id as string,
    name: p.name as string,
    subject: p.credentialing_subject as string,
    group: (embedded(p.payer_group)?.name as string | undefined) ?? "",
  }));

  const openRows = (enrollments ?? []).filter(
    (e) => e.status === "in_preparation" || e.status === "draft",
  );

  return (
    <div>
      <Link
        href="/portal/admin/credentialing"
        className="text-sm text-brand-blue hover:underline"
      >
        ← Credentialing console
      </Link>

      <header className="mt-2 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-navy-900">
            {org.legal_name as string}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {org.dba_name ? <>dba {org.dba_name as string} · </> : null}
            EIN {(org.ein as string | null) ?? "—"} · org NPI{" "}
            <span className="font-mono">
              {(org.primary_organizational_npi as string | null) ?? "—"}
            </span>
          </p>
        </div>
        <NewLocation organizationId={orgId} />
      </header>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-navy-900">Locations</h2>
        <p className="mt-1 text-sm text-slate-600">
          Enrollment attaches here. A location bills under its own Type 2 NPI
          when it has one, otherwise the organization&rsquo;s.
        </p>
        {(locations ?? []).length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
            No locations yet. Add one before adding providers.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
            {(locations ?? []).map((l) => {
              const own = l.organizational_npi as string | null;
              const eng = (engagements ?? []).filter(
                (e) => e.location_id === l.id,
              );
              return (
                <li key={l.id as string} className="px-4 py-3">
                  <div className="flex flex-wrap items-baseline gap-x-3">
                    <span className="font-medium text-navy-900">
                      {locationLabel(l)}
                    </span>
                    <span className="text-sm text-slate-500">
                      {l.city as string}, {l.state as string}{" "}
                      {l.postal_code as string}
                    </span>
                    <span className="ml-auto font-mono text-xs text-slate-400">
                      {own ? `own NPI ${own}` : "org NPI"}
                    </span>
                  </div>
                  {eng.length > 0 && (
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {eng.map((e) => {
                        const p = embedded(e.provider);
                        if (!p) return null;
                        const unknown =
                          p.medicare_enrollment_status === "unknown";
                        return (
                          <li
                            key={e.id as string}
                            className="rounded border border-slate-200 px-2 py-1 text-xs"
                          >
                            <span className="text-navy-900">
                              {p.first_name as string} {p.last_name as string}
                            </span>{" "}
                            <span className="text-slate-400">
                              {p.credentials as string}
                            </span>{" "}
                            <span className="font-mono text-slate-400">
                              {p.individual_npi as string}
                            </span>
                            {unknown ? (
                              <span className="ml-1 font-semibold text-orange-700">
                                Medicare unknown
                              </span>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {locationOptions.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-3">
          <NewProvider organizationId={orgId} locations={locationOptions} />
          <OpenEnrollments
            organizationId={orgId}
            locations={locationOptions}
            providers={providerOptions}
            products={productOptions}
          />
        </div>
      )}

      {openRows.length > 0 && (
        <BatchBuilder
          organizationId={orgId}
          locations={locationOptions}
          groups={(groups ?? []).map((g) => ({
            id: g.id as string,
            name: g.name as string,
          }))}
          enrollments={openRows.map((e) => ({
            id: e.id as string,
            label: `${e.payer_group} · ${e.payer_product}`,
            who: e.provider as string,
            location: e.location as string,
          }))}
        />
      )}

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-navy-900">Enrollments</h2>
        {(enrollments ?? []).length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
            None yet.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full min-w-[46rem] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2 font-semibold">Payer product</th>
                  <th className="px-4 py-2 font-semibold">Filed for</th>
                  <th className="px-4 py-2 font-semibold">Location</th>
                  <th className="px-4 py-2 font-semibold">Status</th>
                  <th className="px-4 py-2 font-semibold">Effective</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(enrollments ?? []).map((e) => (
                  <tr key={e.id as string}>
                    <td className="px-4 py-2.5">
                      <span className="block text-xs text-slate-400">
                        {e.payer_group as string}
                      </span>
                      <span className="font-medium text-navy-900">
                        {e.payer_product as string}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">
                      {e.provider as string}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">
                      {e.location as string}
                    </td>
                    <td className="px-4 py-2.5">
                      {STATUS_LABEL[e.status as string] ?? (e.status as string)}
                      {e.submission_batch_id ? (
                        <Link
                          href={`/portal/admin/credentialing/batches/${e.submission_batch_id}`}
                          className="ml-2 text-xs text-brand-blue hover:underline"
                        >
                          batch
                        </Link>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs tabular-nums text-slate-500">
                      {(e.effective_date as string | null) ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {e.status === "in_preparation" || e.status === "draft" ? (
                        <DeclineEnrollment enrollmentId={e.id as string} />
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
