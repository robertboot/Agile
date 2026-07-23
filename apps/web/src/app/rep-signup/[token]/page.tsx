import Image from "next/image";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { RepSignupForm } from "./RepSignupForm";

export const metadata = { title: "Rep Signup" };

export default async function RepSignupPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let invite: {
    email: string;
    invited_name: string | null;
    territory: string | null;
    status: string;
    expires_at: string;
  } | null = null;
  let contractBody = "";

  if (/^[0-9a-f-]{36}$/.test(token)) {
    const db = createAdminClient();
    const [{ data }, { data: contract }] = await Promise.all([
      db
        .from("rep_invites")
        .select("email, invited_name, territory, status, expires_at")
        .eq("id", token)
        .maybeSingle(),
      db.from("contract_templates").select("body").limit(1).maybeSingle(),
    ]);
    invite = data;
    contractBody = contract?.body ?? "";
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
            <h1 className="text-2xl font-bold text-navy-900">Join the Agile team</h1>
            <p className="mt-2 text-slate-600">
              Welcome{invite.invited_name ? `, ${invite.invited_name}` : ""}! Review and sign your
              Sales Representative Agreement below, set your password, and your portal account is
              live immediately.
            </p>
            <div className="mt-8">
              <RepSignupForm
                token={token}
                invitedName={invite.invited_name ?? ""}
                email={invite.email}
                territory={invite.territory}
                contractBody={contractBody}
              />
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
            <h1 className="text-xl font-bold text-navy-900">
              {invite?.status === "completed"
                ? "This signup has already been completed"
                : "This signup link isn't valid"}
            </h1>
            <p className="mt-2 text-slate-600">
              {invite?.status === "completed"
                ? "Your account is active — sign in from the Rep Login page."
                : "The link may have expired. Contact Agile for a new invite."}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
