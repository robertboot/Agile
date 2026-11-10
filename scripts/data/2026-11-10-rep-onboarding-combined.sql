-- ============================================================================
-- 20261110000001_rep_onboarding.sql
-- Onboarding checklist for a rep: mailing address, a business-card upload,
-- and the steps that have to happen before they can actually sell.
--
-- Each step is a timestamp rather than a boolean. The UI renders it as a
-- checkbox either way, but a timestamp also records WHEN it happened, which
-- a boolean throws away and which matters when chasing what is outstanding.
--
-- "Has logged on" is deliberately NOT here: auth.users.last_sign_in_at
-- already knows, and a hand-ticked copy of it would go stale.
-- ============================================================================

alter table public.rep_details
  add column if not exists mailing_address_line1 text,
  add column if not exists mailing_address_line2 text,
  add column if not exists mailing_city text,
  add column if not exists mailing_state text,
  add column if not exists mailing_zip text,
  add column if not exists business_card_path text,
  add column if not exists slack_invited_at timestamptz,
  add column if not exists slack_accepted_at timestamptz,
  add column if not exists email_setup_at timestamptz,
  add column if not exists business_cards_ordered_at timestamptz,
  add column if not exists training_completed_at timestamptz;

comment on column public.rep_details.business_card_path is
  'Path in the private business-cards bucket. Served only through a short-lived signed URL.';
comment on column public.rep_details.slack_accepted_at is
  'When the rep accepted the Slack invite — not when it was sent (slack_invited_at).';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'business-cards',
    'business-cards',
    false,
    10 * 1024 * 1024,
    array['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/webp']
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Verification: columns should be 11, bucket should be 1.
select
  (select count(*) from information_schema.columns
     where table_name='rep_details'
       and column_name in ('mailing_address_line1','mailing_address_line2','mailing_city',
                           'mailing_state','mailing_zip','business_card_path',
                           'slack_invited_at','slack_accepted_at','email_setup_at',
                           'business_cards_ordered_at','training_completed_at')) as columns,
  (select count(*) from storage.buckets where id='business-cards') as bucket;
