import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePortalUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { EditProviderForm, type ProviderRecord } from "./EditProviderForm";

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

  // RLS lets reps update only their own unapproved providers; admins any.
  const editable = user.role === "admin" || !provider.approved;

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
          Registered {formatDate(provider.created_at)} · BAA: {baaStatus}
        </p>
      </div>

      <EditProviderForm provider={provider as unknown as ProviderRecord} editable={editable} />
    </div>
  );
}
