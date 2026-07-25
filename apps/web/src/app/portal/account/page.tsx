import { requirePortalUser } from "@/lib/auth";
import { PasswordForm } from "./AccountForm";

export default async function AccountPage() {
  const user = await requirePortalUser();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Your account</h1>
        <p className="mt-1 text-sm text-slate-500">
          {user.displayName} · {user.email} · {user.role}
        </p>
      </div>
      <div>
        <h2 className="label-mono mb-3 text-slate-500">Change password</h2>
        <PasswordForm />
      </div>
    </div>
  );
}
