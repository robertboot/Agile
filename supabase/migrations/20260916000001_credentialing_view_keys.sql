-- ============================================================================
-- 20260916000001_credentialing_view_keys.sql
-- Expose the foreign keys on v_enrollment_detail so callers can filter by them.
--
-- The view was written for display: it resolves names and dates for a human
-- reading a row. That left it unfilterable — "every enrollment for this
-- organization" had to fetch the location ids first and then filter on a
-- column the view does not have, which fails outright.
--
-- Adding the keys keeps the readable columns and makes the view usable as the
-- one read path for enrollments, rather than a display-only projection that
-- every caller has to work around.
-- ============================================================================

drop view if exists credentialing.v_recredentialing_due;
drop view if exists credentialing.v_panel_recheck_due;
drop view if exists credentialing.v_work_queue;
drop view if exists credentialing.v_enrollment_detail;

create view credentialing.v_enrollment_detail as
select
    e.id,
    -- Keys, so this view can be filtered rather than only read.
    o.id                                                as organization_id,
    l.id                                                as location_id,
    e.provider_id,
    e.payer_product_id,
    pg.id                                               as payer_group_id,
    -- Display columns.
    o.legal_name                                        as organization,
    coalesce(l.name, l.address_line1)                   as location,
    l.city, l.state,
    credentialing.effective_organizational_npi(l.id)    as organizational_npi,
    case when e.provider_id is null then '(location-scoped)'
         else p.first_name || ' ' || p.last_name end    as provider,
    p.individual_npi,
    pg.name                                             as payer_group,
    pp.name                                             as payer_product,
    pp.classification::text                             as classification,
    pp.credentialing_subject::text                      as subject,
    pp.filing_route::text                               as filing_route,
    e.status::text                                      as status,
    credentialing.enrollment_disposition(e.status)      as disposition,
    e.effective_date,
    e.approved_on,
    e.recredentialing_due_on,
    e.panel_recheck_due_on,
    e.submission_batch_id,
    sb.submitted_on,
    sb.effective_date                                   as batch_effective_date
from credentialing.enrollment e
join credentialing.location l      on l.id  = e.location_id
join credentialing.organization o  on o.id  = l.organization_id
join credentialing.payer_product pp on pp.id = e.payer_product_id
join credentialing.payer_group pg  on pg.id = pp.payer_group_id
left join credentialing.provider p on p.id  = e.provider_id
left join credentialing.submission_batch sb on sb.id = e.submission_batch_id
where e.deleted_at is null;

create view credentialing.v_work_queue as
select * from credentialing.v_enrollment_detail
where disposition in ('action_ours', 'waiting_payer');

create view credentialing.v_panel_recheck_due as
select *, panel_recheck_due_on - current_date as days_until_due
from credentialing.v_enrollment_detail
where status = 'panel_closed';

create view credentialing.v_recredentialing_due as
select *,
       recredentialing_due_on - current_date as days_until_due,
       recredentialing_due_on is null        as interval_unknown
from credentialing.v_enrollment_detail
where status = 'approved';

alter view credentialing.v_enrollment_detail   set (security_invoker = true);
alter view credentialing.v_work_queue          set (security_invoker = true);
alter view credentialing.v_panel_recheck_due   set (security_invoker = true);
alter view credentialing.v_recredentialing_due set (security_invoker = true);

grant select on credentialing.v_enrollment_detail, credentialing.v_work_queue,
                credentialing.v_panel_recheck_due, credentialing.v_recredentialing_due
    to authenticated, service_role;
