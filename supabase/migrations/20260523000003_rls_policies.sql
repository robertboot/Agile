-- ============================================================================
-- 0003_rls_policies.sql
-- Row-Level Security for every Phase 1 table.
-- Visibility matrix:
--   provider: full CRUD on own data (soft-delete only)
--   rep:      SELECT on data of assigned providers (time-bounded)
--   office_manager: SELECT all clinical data, CRUD on Phase 2 order tables
--   admin:    full access
--   anon:     no access to PHI
-- Service role bypasses RLS (used only inside Edge Functions).
-- ============================================================================

-- Enable RLS on every table -------------------------------------------------
alter table public.profiles enable row level security;
alter table public.rep_provider_assignments enable row level security;
alter table public.invite_codes enable row level security;
alter table public.patients enable row level security;
alter table public.wounds enable row level security;
alter table public.wound_visits enable row level security;
alter table public.wound_measurements enable row level security;
alter table public.wound_photos enable row level security;
alter table public.lookup_anatomical_locations enable row level security;
alter table public.lookup_npuap_stages enable row level security;
alter table public.lookup_wagner_grades enable row level security;
alter table public.audit_log enable row level security;
alter table public.products enable row level security;
alter table public.pre_determination_letters enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.commissions enable row level security;
alter table public.payments enable row level security;
alter table public.conflict_log enable row level security;

-- ===== profiles =====
create policy profiles_self_select on public.profiles
    for select to authenticated
    using (id = auth.uid());

create policy profiles_self_update on public.profiles
    for update to authenticated
    using (id = auth.uid())
    with check (id = auth.uid());

-- Provider sees the assigned rep's profile (for "Your rep is…" UI).
create policy profiles_provider_sees_rep on public.profiles
    for select to authenticated
    using (
        role = 'rep'
        and exists (
            select 1 from public.rep_provider_assignments a
            where a.rep_id = profiles.id
              and a.provider_id = auth.uid()
              and a.active and a.deleted_at is null
        )
    );

-- Rep sees profiles of assigned providers.
create policy profiles_rep_sees_assigned on public.profiles
    for select to authenticated
    using (
        public.current_role() = 'rep'
        and public.is_rep_of(profiles.id)
    );

create policy profiles_admin_all on public.profiles
    for all to authenticated
    using (public.is_admin())
    with check (public.is_admin());

create policy profiles_om_select on public.profiles
    for select to authenticated
    using (public.is_office_manager());

-- ===== rep_provider_assignments =====
create policy rpa_self_select on public.rep_provider_assignments
    for select to authenticated
    using (rep_id = auth.uid() or provider_id = auth.uid());

create policy rpa_admin_all on public.rep_provider_assignments
    for all to authenticated
    using (public.is_admin())
    with check (public.is_admin());

-- ===== invite_codes =====
-- Reps see and manage their own. Creation gated through Edge Function (service role).
create policy invite_codes_rep_select on public.invite_codes
    for select to authenticated
    using (rep_id = auth.uid());

create policy invite_codes_admin_all on public.invite_codes
    for all to authenticated
    using (public.is_admin())
    with check (public.is_admin());

-- ===== patients =====
create policy patients_provider_select on public.patients
    for select to authenticated
    using (provider_id = auth.uid() and deleted_at is null);

create policy patients_provider_insert on public.patients
    for insert to authenticated
    with check (provider_id = auth.uid() and public.current_role() = 'provider');

create policy patients_provider_update on public.patients
    for update to authenticated
    using (provider_id = auth.uid())
    with check (provider_id = auth.uid());

create policy patients_rep_select on public.patients
    for select to authenticated
    using (public.is_rep_of(provider_id) and deleted_at is null);

create policy patients_om_select on public.patients
    for select to authenticated
    using (public.is_office_manager() and deleted_at is null);

create policy patients_admin_all on public.patients
    for all to authenticated
    using (public.is_admin())
    with check (public.is_admin());

-- ===== wounds =====
create policy wounds_provider_all on public.wounds
    for all to authenticated
    using (provider_id = auth.uid())
    with check (provider_id = auth.uid());

create policy wounds_rep_select on public.wounds
    for select to authenticated
    using (public.is_rep_of(provider_id) and deleted_at is null);

create policy wounds_om_select on public.wounds
    for select to authenticated
    using (public.is_office_manager() and deleted_at is null);

create policy wounds_admin_all on public.wounds
    for all to authenticated
    using (public.is_admin())
    with check (public.is_admin());

-- ===== wound_visits =====
create policy wv_provider_all on public.wound_visits
    for all to authenticated
    using (provider_id = auth.uid())
    with check (provider_id = auth.uid());

create policy wv_rep_select on public.wound_visits
    for select to authenticated
    using (
        exists (
            select 1 from public.wounds w
            where w.id = wound_visits.wound_id
              and public.is_rep_of(w.provider_id)
        )
        and deleted_at is null
    );

create policy wv_om_select on public.wound_visits
    for select to authenticated
    using (public.is_office_manager() and deleted_at is null);

create policy wv_admin_all on public.wound_visits
    for all to authenticated
    using (public.is_admin())
    with check (public.is_admin());

-- ===== wound_measurements =====
create policy wm_provider_all on public.wound_measurements
    for all to authenticated
    using (
        exists (
            select 1 from public.wound_visits v
            where v.id = wound_measurements.visit_id
              and v.provider_id = auth.uid()
        )
    )
    with check (
        exists (
            select 1 from public.wound_visits v
            where v.id = wound_measurements.visit_id
              and v.provider_id = auth.uid()
        )
    );

create policy wm_rep_select on public.wound_measurements
    for select to authenticated
    using (
        exists (
            select 1
            from public.wound_visits v
            join public.wounds w on w.id = v.wound_id
            where v.id = wound_measurements.visit_id
              and public.is_rep_of(w.provider_id)
        )
        and deleted_at is null
    );

create policy wm_om_select on public.wound_measurements
    for select to authenticated
    using (public.is_office_manager() and deleted_at is null);

create policy wm_admin_all on public.wound_measurements
    for all to authenticated
    using (public.is_admin())
    with check (public.is_admin());

-- ===== wound_photos (metadata only — bytes via signed URL) =====
create policy wp_provider_all on public.wound_photos
    for all to authenticated
    using (
        exists (
            select 1 from public.wound_visits v
            where v.id = wound_photos.visit_id
              and v.provider_id = auth.uid()
        )
    )
    with check (
        exists (
            select 1 from public.wound_visits v
            where v.id = wound_photos.visit_id
              and v.provider_id = auth.uid()
        )
    );

create policy wp_rep_select on public.wound_photos
    for select to authenticated
    using (
        exists (
            select 1
            from public.wound_visits v
            join public.wounds w on w.id = v.wound_id
            where v.id = wound_photos.visit_id
              and public.is_rep_of(w.provider_id)
        )
        and deleted_at is null
    );

create policy wp_om_select on public.wound_photos
    for select to authenticated
    using (public.is_office_manager() and deleted_at is null);

create policy wp_admin_all on public.wound_photos
    for all to authenticated
    using (public.is_admin())
    with check (public.is_admin());

-- ===== Storage bucket policies (wound-photos) =====
-- Providers can write photos under their own UUID prefix.
-- Reads happen via signed URLs from Edge Functions (service role); direct SELECT denied.
create policy wp_storage_insert_provider on storage.objects
    for insert to authenticated
    with check (
        bucket_id = 'wound-photos'
        and (storage.foldername(name))[1] = auth.uid()::text
        and public.current_role() = 'provider'
    );

-- Deny direct selects; all reads must go through signed URLs from Edge Fn.
-- (No SELECT policy = denied by default once RLS is on.)

-- ===== lookup tables (read-only to all authenticated) =====
create policy lookups_read_anat on public.lookup_anatomical_locations
    for select to authenticated using (active);
create policy lookups_read_npuap on public.lookup_npuap_stages
    for select to authenticated using (true);
create policy lookups_read_wagner on public.lookup_wagner_grades
    for select to authenticated using (true);

-- ===== audit_log (read-only to admins) =====
create policy audit_admin_select on public.audit_log
    for select to authenticated
    using (public.is_admin());

-- ===== Phase 2 stubs (locked to admin until Phase 2 finalizes policies) =====
create policy products_admin_all on public.products
    for all to authenticated
    using (public.is_admin())
    with check (public.is_admin());
create policy products_authenticated_read on public.products
    for select to authenticated
    using (active);

create policy predeterm_admin_all on public.pre_determination_letters
    for all to authenticated
    using (public.is_admin())
    with check (public.is_admin());
create policy predeterm_provider_read on public.pre_determination_letters
    for select to authenticated
    using (
        exists (
            select 1 from public.wounds w
            where w.id = pre_determination_letters.wound_id
              and w.provider_id = auth.uid()
        )
    );

create policy orders_admin_all on public.orders
    for all to authenticated
    using (public.is_admin() or public.is_office_manager())
    with check (public.is_admin() or public.is_office_manager());
create policy orders_rep_read on public.orders
    for select to authenticated
    using (rep_id = auth.uid());
create policy orders_provider_read on public.orders
    for select to authenticated
    using (provider_id = auth.uid());

create policy oi_admin_all on public.order_items
    for all to authenticated
    using (public.is_admin() or public.is_office_manager())
    with check (public.is_admin() or public.is_office_manager());

create policy commissions_admin_all on public.commissions
    for all to authenticated
    using (public.is_admin())
    with check (public.is_admin());
create policy commissions_rep_read on public.commissions
    for select to authenticated
    using (rep_id = auth.uid());

create policy payments_admin_all on public.payments
    for all to authenticated
    using (public.is_admin() or public.is_office_manager())
    with check (public.is_admin() or public.is_office_manager());

-- ===== conflict_log (admins only) =====
create policy conflict_admin_all on public.conflict_log
    for all to authenticated
    using (public.is_admin())
    with check (public.is_admin());
