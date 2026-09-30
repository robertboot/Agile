-- Name the existing custom pricing set WESTBROOK.
-- Requires migration 20260929000001_prepurchase_pricing_code.sql.
--
-- NOTE: this account is recorded in prod against provider "Gulf Coast Mobile
-- Wound Care". Confirm that is the right deal before running.

update public.prepurchase_accounts
set    pricing_code = 'WESTBROOK',
       updated_at   = now()
where  id = '1e5ef9de-2ee2-406e-ab51-fd0cac02815b';

select a.id, a.pricing_code, p.practice_name, a.credit_cents / 100.0 as remaining_usd
from   public.prepurchase_accounts a
join   public.providers p on p.id = a.provider_id
where  a.id = '1e5ef9de-2ee2-406e-ab51-fd0cac02815b';
