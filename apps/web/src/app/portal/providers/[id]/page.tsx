import Link from "next/link";
import { notFound } from "next/navigation";
import { isValidNpi } from "@agile/shared";
import { requirePortalUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { EditProviderForm, type ProviderRecord } from "./EditProviderForm";
import { ProviderAdminOverride } from "./ProviderAdminOverride";
import { ReassignRep, type RepOption } from "./ReassignRep";

export default async function ProviderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requirePortalUser();
  const supabase = await createClient();

  const { data: provider } = await supabase
    .from("providers")
    .select("*, profiles:rep_id(display_name)")
    .eq("id", id)
    .maybeSingle();
  if (!provider) notFound();

  // Reps list for admin reassignment (any rep, incl. suspended legacy reps).
  let reps: RepOption[] = [];
  if (user.role === "admin") {
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name, status")
      .eq("role", "rep")
      .order("display_name");
    reps = (data ?? []) as RepOption[];
  }

  // RLS lets reps update only their own unapproved providers; admins any.
  const editable = user.role === "admin" || !provider.approved;

  // Partial saves are allowed — surface what's still missing before approval.
  const missing: string[] = [];
  if (!provider.individual_npi) missing.push("Individual NPI");
  else if (!isValidNpi(provider.individual_npi)) missing.push("Individual NPI (check digit invalid)");
  for (const [label, val] of [
    ["Address", provider.address_line1],
    ["City", provider.city],
    ["State", provider.state],
    ["ZIP", provider.zip],
    ["Provider name", provider.provider_first && provider.provider_last],
  ] as const) {
    if (!val) missing.push(label);
  }

  const baaStatus = provider.baa_accepted_at
    ? `e-signed by ${provider.baa_signatory_name ?? "provider"} on ${formatDate(provider.baa_accepted_at)}`
    : provider.baa_document_path
      ? "signed copy uploaded"
      : "missing";

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/portal/providers" className="text-sm text-slate-400 hover:text-slate-600">
          ← Providers
        </Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold text-navy-900">{provider.practice_name}</h1>
          <span
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              provider.mednecessity_status === "onboarded"
                ? "bg-emerald-100 text-emerald-800"
                : provider.approved
                  ? "bg-blue-100 text-blue-800"
                  : "bg-amber-100 text-amber-800"
            }`}
          >
            {provider.mednecessity_status === "onboarded"
              ? "Onboarded"
              : provider.approved
                ? "Approved — MedNecessity pending"
                : "Awaiting approval"}
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {user.role === "admin" &&
            `Rep: ${(provider.profiles as unknown as { display_name: string })?.display_name} · `}
          Registered {formatDate(provider.created_at)} · BAA: {baaStatus} · Agreement:{" "}
          {provider.agreement_document_path
            ? `on file${provider.agreement_signed_at ? `, signed ${formatDate(provider.agreement_signed_at)}` : ""}`
            : "missing"}
        </p>
      </div>

      {missing.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="font-semibold">Incomplete —</span> still needs: {missing.join(", ")}. Saved,
          but complete these before the provider can order.
        </div>
      )}

      {user.role === "admin" && (
        <ProviderAdminOverride
          providerId={provider.id}
          approved={provider.approved}
          onboarded={provider.mednecessity_status === "onboarded"}
        />
      )}

      {user.role === "admin" && reps.length > 0 && (
        <ReassignRep providerId={provider.id} currentRepId={provider.rep_id} reps={reps} />
      )}

      <EditProviderForm provider={provider as unknown as ProviderRecord} editable={editable} />
    </div>
  );
}
