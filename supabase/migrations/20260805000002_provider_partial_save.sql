-- ============================================================================
-- 20260805000002_provider_partial_save.sql
-- Allow saving a provider with incomplete info (data entry in progress). Only
-- the practice name stays required; identity/NPI fields can be filled in later.
-- Ordering is still gated on approve + MedNecessity-onboarded, so an incomplete
-- provider can be saved but never ordered against until completed.
-- ============================================================================

alter table public.providers alter column address_line1 drop not null;
alter table public.providers alter column city drop not null;
alter table public.providers alter column state drop not null;
alter table public.providers alter column zip drop not null;
alter table public.providers alter column provider_first drop not null;
alter table public.providers alter column provider_last drop not null;
alter table public.providers alter column individual_npi drop not null;
