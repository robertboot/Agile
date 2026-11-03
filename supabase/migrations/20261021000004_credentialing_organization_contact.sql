-- ============================================================================
-- 20261021000004_credentialing_organization_contact.sql
-- Who to ask at the practice.
--
-- The punch list (0002 of today) routes each item to an owner: ours, the
-- provider's, or the practice's. Two of those three are people outside
-- Credence, and the schema had nowhere to put a person — no contact table, no
-- email column on organization. So "Shantelle at UPRI is the one who can run
-- the Railroad PTAN request" had nowhere to live except a chat message, which
-- is the same failure as the missing PTAN one level up.
--
-- This matters for Railroad specifically. Palmetto will only take a PTAN
-- request from the provider or someone the provider employs — not a billing
-- agency, not us — so the name of that person is part of being able to file at
-- all, not an address-book nicety.
--
-- Deliberately small: a name, how to reach them, and what they are for. Not a
-- CRM. `role` is text with a check rather than an enum because the list will
-- grow from use and a new value should not need a migration.
-- ============================================================================

create table credentialing.organization_contact (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null
        references credentialing.organization(id) on delete cascade,
    full_name text not null,
    email text,
    phone text,
    -- What this person is the contact FOR. enrollment_requestor is the one the
    -- payer will accept a request from; the rest are for routing questions.
    role text not null default 'other',
    title text,
    note text,
    is_primary boolean not null default false,
    created_by uuid references public.profiles(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,

    constraint organization_contact_name_ck
        check (char_length(trim(full_name)) between 1 and 200),
    constraint organization_contact_role_ck check (role in (
        'enrollment_requestor',  -- may submit payer requests for the practice
        'credentialing',         -- our day-to-day counterpart
        'billing',
        'clinical',
        'other'
    )),
    -- A contact nobody can reach is not a contact.
    constraint organization_contact_reachable_ck check (
        email is not null or phone is not null
    ),
    constraint organization_contact_email_ck check (
        email is null or email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    )
);

create index organization_contact_org_idx
    on credentialing.organization_contact (organization_id, role)
    where deleted_at is null;
-- One primary per organization, enforced rather than hoped for.
create unique index organization_contact_primary_uniq
    on credentialing.organization_contact (organization_id)
    where is_primary and deleted_at is null;

create trigger organization_contact_updated_at
    before update on credentialing.organization_contact
    for each row execute function public.set_updated_at();

comment on table credentialing.organization_contact is
    'People at the practice. role = enrollment_requestor marks whoever the '
    'payer will accept a request from — Railroad Medicare, for one, takes a '
    'PTAN request only from the provider or someone they employ.';

alter table credentialing.organization_contact enable row level security;

create policy organization_contact_staff_all on credentialing.organization_contact
    for all to authenticated
    using (public.is_admin() or credentialing.is_staff())
    with check (public.is_admin() or credentialing.is_staff());

-- Client data, and it carries a name and an email address, so it is audited
-- like the organization it belongs to.
create trigger audit_organization_contact
    after insert or update or delete on credentialing.organization_contact
    for each row execute function public.fn_audit_write();
