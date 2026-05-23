-- ============================================================================
-- 0004_legacy_data_fields.sql
-- Adds columns needed to import the historic CSVs from the legacy system:
--   - Reps List.csv → FDA training completion date
--   - Registered Providers.csv → office contact name, address, signature, approval status
--   - All Orders.csv → reps-to-provider linkage derived from RequestedbyEmail
-- ============================================================================

alter table public.profiles
    add column if not exists fda_training_completed_at date,
    add column if not exists office_contact_name text,
    add column if not exists practice_address text,
    add column if not exists signature_path text,
    -- Free-form notes from the legacy approval flow (Approved / Rejected reason, etc).
    add column if not exists legacy_approval_status text
        check (legacy_approval_status is null or legacy_approval_status in ('Approved', 'Rejected'));

comment on column public.profiles.fda_training_completed_at is
    'Date the rep completed FDA training (from legacy Reps List.csv).';
comment on column public.profiles.office_contact_name is
    'Practice office contact who handles registration/orders (provider profiles only).';
comment on column public.profiles.practice_address is
    'Single-line practice address. Phase 2 may parse into street/city/state/zip.';
comment on column public.profiles.signature_path is
    'Storage path of the provider signature image (legacy filename).';
comment on column public.profiles.legacy_approval_status is
    'Approval status from the legacy Registered Providers workflow. Use profiles.status going forward.';
