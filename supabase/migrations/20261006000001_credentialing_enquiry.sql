-- ============================================================================
-- 20261006000001_credentialing_enquiry.sql
-- Enquiries from the Credence website's contact form.
--
-- The contact page carried a mailto: address, which is a published email
-- address on a public page — harvested within days. A form keeps the address
-- off the page entirely.
--
-- The enquiry lands here rather than in an inbox. An inbox depends on someone
-- reading it, on email being wired up, and on the message not being filtered;
-- a row depends on none of those, and the console can show what has not been
-- answered. Email notification can be added later as a convenience on top,
-- never as the system of record.
--
-- This is Credence's data, so it lives in the credentialing schema rather than
-- public.contact_messages, which belongs to the wound-care site.
-- ============================================================================

create table credentialing.enquiry (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    email text not null,
    organization text,
    message text not null,

    -- Where it came from, so a surge can be traced to a campaign or a scraper.
    source_path text,

    -- Worked, not deleted. An enquiry nobody answered is the thing worth
    -- seeing, so there is no delete path from the console.
    handled_at timestamptz,
    handled_by uuid references public.profiles(id),
    note text,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint enquiry_name_ck    check (char_length(trim(name)) between 1 and 200),
    constraint enquiry_email_ck   check (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
    constraint enquiry_message_ck check (char_length(trim(message)) between 1 and 5000),
    -- A note explains a decision, so it only makes sense once one was made.
    constraint enquiry_note_ck    check (note is null or handled_at is not null)
);

create index enquiry_unhandled_idx on credentialing.enquiry (created_at desc)
    where handled_at is null;

create trigger enquiry_updated_at before update on credentialing.enquiry
    for each row execute function public.set_updated_at();

comment on table credentialing.enquiry is
    'Contact form submissions from the Credence public site. Written by the '
    'server action under the service role; read by credentialing staff.';

-- ----------------------------------------------------------------------------
-- RLS. Deny by default, and deliberately no insert policy: the public form
-- writes through the service role from a server action, which bypasses RLS.
-- Nothing holding a browser token should be able to write here directly, and
-- an anon insert policy would be exactly that.
-- ----------------------------------------------------------------------------
alter table credentialing.enquiry enable row level security;

create policy enquiry_staff_all on credentialing.enquiry
    for all to authenticated
    using (public.is_admin() or credentialing.is_staff())
    with check (public.is_admin() or credentialing.is_staff());

grant select, insert, update on credentialing.enquiry to authenticated;
grant all on credentialing.enquiry to service_role;
