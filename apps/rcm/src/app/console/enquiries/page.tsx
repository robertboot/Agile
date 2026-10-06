import { requireStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { markHandled, reopen } from "./actions";

export const metadata = { title: "Enquiries" };

interface EnquiryRow {
  id: string;
  name: string;
  email: string;
  organization: string | null;
  message: string;
  handled_at: string | null;
  note: string | null;
  created_at: string;
}

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

function Enquiry({ e }: { e: EnquiryRow }) {
  const open = !e.handled_at;

  return (
    <article
      className={`rounded-lg border p-5 ${
        open ? "border-credence-line bg-white" : "border-slate-100 bg-slate-50/60"
      }`}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          <span className="font-semibold text-credence-navy">{e.name}</span>
          {e.organization && (
            <span className="ml-2 text-sm text-slate-500">{e.organization}</span>
          )}
        </div>
        <span className="text-xs text-slate-400">{when(e.created_at)}</span>
      </header>

      <a
        href={`mailto:${e.email}`}
        className="mt-0.5 inline-block text-sm text-credence-navy-soft underline underline-offset-4"
      >
        {e.email}
      </a>

      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
        {e.message}
      </p>

      {open ? (
        <form action={markHandled} className="mt-4 flex flex-wrap items-center gap-2">
          <input type="hidden" name="id" value={e.id} />
          <input
            name="note"
            placeholder="What you did (optional)"
            className="min-w-0 flex-1 rounded border border-credence-line px-3 py-1.5 text-sm outline-none focus:border-credence-navy"
          />
          <button className="btn-credence rounded px-4 py-1.5 text-sm font-semibold">
            Mark handled
          </button>
        </form>
      ) : (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3">
          <p className="text-xs text-slate-500">
            Handled {when(e.handled_at!)}
            {e.note && <span className="text-slate-600"> — {e.note}</span>}
          </p>
          <form action={reopen}>
            <input type="hidden" name="id" value={e.id} />
            <button className="text-xs text-credence-navy-soft hover:underline">Reopen</button>
          </form>
        </div>
      )}
    </article>
  );
}

export default async function EnquiriesPage() {
  await requireStaff();

  const { data } = await createAdminClient()
    .schema("credentialing")
    .from("enquiry")
    .select("id, name, email, organization, message, handled_at, note, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = (data ?? []) as EnquiryRow[];
  const open = rows.filter((r) => !r.handled_at);
  const done = rows.filter((r) => r.handled_at);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-credence-navy">Enquiries</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Everything sent through the contact form on credencehp.com.
        </p>
      </div>

      <section>
        <h2 className="text-lg font-semibold text-credence-navy">
          Needs a reply ({open.length})
        </h2>
        <div className="mt-4 space-y-4">
          {open.length === 0 ? (
            <p className="rounded-lg border border-dashed border-credence-line px-5 py-8 text-sm text-slate-500">
              Nothing waiting.
            </p>
          ) : (
            open.map((e) => <Enquiry key={e.id} e={e} />)
          )}
        </div>
      </section>

      {done.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-credence-navy">
            Handled ({done.length})
          </h2>
          <div className="mt-4 space-y-4">
            {done.map((e) => (
              <Enquiry key={e.id} e={e} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
