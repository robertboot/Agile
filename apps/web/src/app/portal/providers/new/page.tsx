import { requirePortalUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ProviderForm } from "./ProviderForm";

export default async function NewProviderPage() {
  const user = await requirePortalUser();
  const supabase = await createClient();

  let reps: { id: string; display_name: string }[] = [];
  if (user.role === "admin") {
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name")
      .eq("role", "rep")
      .eq("status", "active")
      .is("deleted_at", null)
      .order("display_name");
    reps = data ?? [];
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Register a provider</h1>
        <p className="mt-1 text-sm text-slate-500">
          Clinic and rendering provider in one form. NPIs are check-digit validated.
        </p>
      </div>
      <ProviderForm isAdmin={user.role === "admin"} reps={reps} />
    </div>
  );
}
