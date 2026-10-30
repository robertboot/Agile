import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ResetForm } from "./ResetForm";

export default async function ResetPasswordPage() {
  // The recovery link must have established a session by way of /auth/callback.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <Link href="/" className="mb-6 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Agile Medical Group" width={168} height={60} />
        </Link>
        <h1 className="mb-1 text-center text-xl font-semibold text-navy-900">Choose a password</h1>

        {user ? (
          <>
            <p className="mb-6 text-center text-sm text-slate-500">
              Setting a new password for {user.email}.
            </p>
            <ResetForm />
          </>
        ) : (
          <>
            <p className="mb-6 mt-4 text-center text-sm text-slate-600">
              This reset link has expired or has already been used. Reset links last one hour and
              work once.
            </p>
            <Link
              href="/forgot-password"
              className="btn-brand block w-full rounded-lg px-4 py-2.5 text-center font-semibold text-white"
            >
              Request a new link
            </Link>
          </>
        )}
      </div>
      <Link href="/login" className="mt-8 text-sm text-slate-500 hover:text-brand-blue">
        ← Back to sign in
      </Link>
    </main>
  );
}
