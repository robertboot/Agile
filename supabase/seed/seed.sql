-- Local dev seed data. NO PHI. Safe to commit.
-- Loaded automatically by `supabase db reset` if referenced in config.toml.

-- Create test users via the auth schema (local dev only).
-- In production, users come from real sign-ups or the migration scripts.

-- Note: passwords are not seeded here; for local dev you can use the magic-link
-- flow at http://127.0.0.1:54324 (Inbucket) to fish out the email.

-- Lookup data already seeded in 0001_init_schema.sql migration.

-- ============================================================================
-- Portal dev seed (Phase 2). LOCAL DEV ONLY — fake users, fake provider.
-- admin@dev.local / password123  ·  rep@dev.local / password123
-- ============================================================================
insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new, email_change_token_current
) values
    ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111',
     'authenticated', 'authenticated', 'admin@dev.local',
     crypt('password123', gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}', '{}', now(), now(),
     '', '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222',
     'authenticated', 'authenticated', 'rep@dev.local',
     crypt('password123', gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}', '{}', now(), now(),
     '', '', '', '', '')
on conflict (id) do nothing;

insert into auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
) values
    (gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
     '{"sub":"11111111-1111-1111-1111-111111111111","email":"admin@dev.local"}',
     'email', '11111111-1111-1111-1111-111111111111', now(), now(), now()),
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222222',
     '{"sub":"22222222-2222-2222-2222-222222222222","email":"rep@dev.local"}',
     'email', '22222222-2222-2222-2222-222222222222', now(), now(), now())
on conflict do nothing;

insert into public.profiles (id, role, status, display_name, email) values
    ('11111111-1111-1111-1111-111111111111', 'admin', 'active', 'Dev Admin', 'admin@dev.local'),
    ('22222222-2222-2222-2222-222222222222', 'rep', 'active', 'Dev Rep', 'rep@dev.local')
on conflict (id) do nothing;

insert into public.rep_details (profile_id, territory) values
    ('22222222-2222-2222-2222-222222222222', 'Texas')
on conflict (profile_id) do nothing;

-- One already-onboarded provider so the order flow is exercisable immediately.
insert into public.providers (
    id, rep_id, practice_name, practice_type, address_line1, city, state, zip,
    provider_first, provider_last, credentials, individual_npi,
    approved, approved_by, approved_at, mednecessity_status,
    mednecessity_affiliate_id, mednecessity_clinic_id, mednecessity_provider_id, created_by
) values (
    '33333333-3333-3333-3333-333333333333',
    '22222222-2222-2222-2222-222222222222',
    'Gulf Coast Wound Care', 'Wound care clinic', '100 Medical Plaza Dr', 'Houston', 'TX', '77030',
    'Dana', 'Whitfield', 'DPM', '1234567893',
    true, '11111111-1111-1111-1111-111111111111', now(), 'onboarded',
    'SIM-AFF-SEED', 'SIM-CLN-SEED', 'SIM-PRV-SEED',
    '22222222-2222-2222-2222-222222222222'
)
on conflict (id) do nothing;

-- Master admin (Robert). LOCAL DEV password — hosted env uses real sign-up/reset.
insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new, email_change_token_current
) values (
    '00000000-0000-0000-0000-000000000000', '99999999-9999-9999-9999-999999999999',
    'authenticated', 'authenticated', 'robert@agilemedgroup.com',
    crypt('AgileAdmin2026!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(),
    '', '', '', '', ''
) on conflict (id) do nothing;

insert into auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
) values (
    gen_random_uuid(), '99999999-9999-9999-9999-999999999999',
    '{"sub":"99999999-9999-9999-9999-999999999999","email":"robert@agilemedgroup.com"}',
    'email', '99999999-9999-9999-9999-999999999999', now(), now(), now()
) on conflict do nothing;

insert into public.profiles (id, role, status, display_name, email) values
    ('99999999-9999-9999-9999-999999999999', 'admin', 'active', 'Robert', 'robert@agilemedgroup.com')
on conflict (id) do nothing;
