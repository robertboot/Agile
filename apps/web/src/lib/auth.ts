import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type PortalRole = "rep" | "admin";

export interface PortalUser {
  id: string;
  email: string;
  displayName: string;
  role: PortalRole;
}

/** Loads the logged-in user's profile; redirects if unauthenticated or not a portal role. */
export async function requirePortalUser(): Promise<PortalUser> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, status, display_name, email")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !["rep", "admin"].includes(profile.role) || profile.status !== "active") {
    redirect("/login?error=not-portal-user");
  }

  return {
    id: profile.id,
    email: profile.email ?? user.email ?? "",
    displayName: profile.display_name,
    role: profile.role as PortalRole,
  };
}

export async function requireAdmin(): Promise<PortalUser> {
  const user = await requirePortalUser();
  if (user.role !== "admin") redirect("/portal");
  return user;
}
