import { requireManager } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { AddStaff } from "./AddStaff";
import { changeStaffRole, removeStaff } from "./actions";

export const metadata = { title: "Team" };

const ROLE_NOTE: Record<string, string> = {
  specialist: "Does the credentialing work.",
  manager: "Credentialing work, plus adds and removes people here.",
  owner: "Everything a manager can do, plus payer reference data.",
};

interface StaffRow {
  profile_id: string;
  role: string;
  created_at: string;
}

interface ProfileRow {
  id: string;
  display_name: string;
  email: string | null;
}

export default async function StaffPage() {
  const me = await requireManager();
  const db = createAdminClient();

  // Two queries rather than an embed: the foreign key crosses schemas
  // (credentialing.staff → public.profiles) and PostgREST will not follow one
  // of those. Joining here is the honest version of what looks like a join.
  const { data: staff } = await db
    .schema("credentialing")
    .from("staff")
    .select("profile_id, role, created_at")
    .is("deleted_at", null)
    .order("created_at");

  const staffRows = (staff ?? []) as StaffRow[];

  const { data: profiles } = await db
    .from("profiles")
    .select("id, display_name, email")
    .in("id", staffRows.map((s) => s.profile_id));

  const byId = new Map(
    ((profiles ?? []) as ProfileRow[]).map((p) => [p.id, p]),
  );

  const rows = staffRows.map((s) => ({ ...s, profile: byId.get(s.profile_id) ?? null }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-rcm-ink">Team</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Who can use Agile RCM. This is separate from the wound-care portal:
          being a rep there grants nothing here, and being on this list grants
          nothing there.
        </p>
      </div>

      <section className="rounded-lg border border-rcm-line bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-rcm-ink">Add someone</h2>
        <p className="mb-3 mt-1 text-sm text-slate-600">
          They need an Agile account already — this grants access, it does not
          create a login.
        </p>
        <AddStaff />
      </section>

      <section>
        <h2 className="text-lg font-semibold text-rcm-ink">
          On the list ({rows.length})
        </h2>
        <div className="mt-3 overflow-x-auto rounded-lg border border-rcm-line bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Name</th>
                <th className="px-4 py-2.5 font-semibold">Email</th>
                <th className="px-4 py-2.5 font-semibold">Role</th>
                <th className="px-4 py-2.5 font-semibold">Added</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-slate-500">
                    Nobody yet. Portal admins can still get in, so this is not a
                    lockout.
                  </td>
                </tr>
              )}
              {rows.map((r) => {
                const isMe = r.profile_id === me.id;
                return (
                  <tr key={r.profile_id}>
                    <td className="px-4 py-2.5 font-medium text-rcm-ink">
                      {r.profile?.display_name ?? "—"}
                      {isMe && <span className="ml-2 text-xs text-slate-400">you</span>}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {r.profile?.email ?? "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <form action={changeStaffRole} className="flex items-center gap-2">
                        <input type="hidden" name="profile_id" value={r.profile_id} />
                        <select
                          name="role"
                          defaultValue={r.role}
                          className="rounded border border-slate-300 px-2 py-1 text-sm"
                        >
                          <option value="specialist">Specialist</option>
                          <option value="manager">Manager</option>
                          <option value="owner">Owner</option>
                        </select>
                        <button className="text-xs text-rcm-accent hover:underline">
                          Save
                        </button>
                      </form>
                      <p className="mt-1 text-xs text-slate-400">{ROLE_NOTE[r.role]}</p>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {isMe ? (
                        <span className="text-xs text-slate-400">
                          Ask another manager
                        </span>
                      ) : (
                        <form action={removeStaff}>
                          <input type="hidden" name="profile_id" value={r.profile_id} />
                          <button className="text-sm text-red-600 hover:underline">
                            Remove
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Removing someone takes effect immediately and keeps the record of who
          had access and when.
        </p>
      </section>
    </div>
  );
}
