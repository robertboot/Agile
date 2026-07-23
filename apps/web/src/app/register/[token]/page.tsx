import Image from "next/image";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { RegistrationForm } from "./RegistrationForm";

export const metadata = { title: "Provider Registration" };

export default async function ProviderRegistrationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let invite: {
    status: string;
    expires_at: string;
    practice_name: string | null;
    repName: string;
  } | null = null;

  if (/^[0-9a-f-]{36}$/.test(token)) {
    const db = createAdminClient();
    const { data } = await db
      .from("provider_invites")
      .select("status, expires_at, practice_name, profiles:rep_id(display_name)")
      .eq("id", token)
      .maybeSingle();
    if (data) {
      invite = {
        status: data.status,
        expires_at: data.expires_at,
        practice_name: data.practice_name,
        repName: (data.profiles as unknown as { display_name: string })?.display_name ?? "your Agile rep",
      };
    }
  }

  const valid =
    invite && invite.status === "pending" && new Date(invite.expires_at) > new Date();

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-3xl items-center px-6">
          <Link href="/">
            <Image src="/logo.png" alt="Agile Medical Group" width={124} height={44} priority />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        {valid && invite ? (
          <>
            <h1 className="text-2xl font-bold text-navy-900">Provider registration</h1>
            <p className="mt-2 text-slate-600">
              {invite.repName} invited{" "}
              {invite.practice_name ? <strong>{invite.practice_name}</strong> : "your practice"} to
              register with Agile Medical Group. Complete the form below — it covers your clinic,
              the rendering provider, and the Business Associate Agreement. Your information goes
              directly to the Agile team for verification and approval.
            </p>
            <div className="mt-8">
              <RegistrationForm token={token} practiceName={invite.practice_name ?? ""} />
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
            <h1 className="text-xl font-bold text-navy-900">
              {invite?.status === "completed"
                ? "This registration has already been submitted"
                : "This registration link isn't valid"}
            </h1>
            <p className="mt-2 text-slate-600">
              {invite?.status === "completed"
                ? "Your registration is with the Agile team for review — your rep will follow up with next steps."
                : "The link may have expired or been mistyped. Please contact your Agile rep for a new registration link."}
            </p>
          </div>
        )}
        <p className="mt-8 text-center text-xs text-slate-400">
          Agile Medical Group, LLC · Questions? Contact your rep or{" "}
          <a href="mailto:info@agilemedgroup.com" className="text-brand-blue hover:underline">
            info@agilemedgroup.com
          </a>
        </p>
      </main>
    </div>
  );
}
