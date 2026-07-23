-- ============================================================================
-- 20260723000001_admin_console.sql
-- Admin console: pricing/cost drafts with GO LIVE, order economics snapshots,
-- rep invites (contract e-sign), and the editable rep contract template.
-- ============================================================================

-- Draft cost changes (applied atomically by GO LIVE) ------------------------
alter table public.product_costs add column draft_cost_per_cm2_cents int
    check (draft_cost_per_cm2_cents is null or draft_cost_per_cm2_cents > 0);

-- Audit pricing-sensitive tables (they had no audit triggers).
create trigger audit_products after insert or update or delete on public.products
    for each row execute function public.fn_audit_write();
create trigger audit_product_costs after insert or update or delete on public.product_costs
    for each row execute function public.fn_audit_write();
create trigger audit_pricing_versions after insert or update or delete on public.pricing_versions
    for each row execute function public.fn_audit_write();

-- Internal economics snapshot per order, captured at order creation so
-- later cost changes never rewrite history. ADMIN-ONLY via RLS.
create table public.order_internals (
    order_id uuid primary key references public.orders(id) on delete cascade,
    cogs_cents bigint not null,
    agile_net_cents bigint not null,
    created_at timestamptz not null default now()
);
alter table public.order_internals enable row level security;
create policy order_internals_admin_all on public.order_internals
    for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Rep invites: admin emails a signup link; the rep e-signs the contract and
-- sets their password. Mirrors provider_invites.
create table public.rep_invites (
    id uuid primary key default gen_random_uuid(),   -- doubles as the link token
    email text not null,
    invited_name text,
    territory text,
    status public.provider_invite_status not null default 'pending',
    completed_profile_id uuid references public.profiles(id),
    created_by uuid references public.profiles(id),
    created_at timestamptz not null default now(),
    expires_at timestamptz not null default (now() + interval '14 days'),
    completed_at timestamptz
);
alter table public.rep_invites enable row level security;
create policy rep_invites_admin_all on public.rep_invites
    for all to authenticated using (public.is_admin()) with check (public.is_admin());
create trigger audit_rep_invites after insert or update or delete on public.rep_invites
    for each row execute function public.fn_audit_write();

-- Contract acceptance lives with the rep.
alter table public.rep_details
    add column contract_accepted_at timestamptz,
    add column contract_signatory text;

-- Editable contract template (single active row; reps may read their own copy).
create table public.contract_templates (
    id uuid primary key default gen_random_uuid(),
    body text not null,
    updated_by uuid references public.profiles(id),
    updated_at timestamptz not null default now()
);
alter table public.contract_templates enable row level security;
create policy contract_templates_read on public.contract_templates
    for select to authenticated using (true);
create policy contract_templates_admin on public.contract_templates
    for all to authenticated using (public.is_admin()) with check (public.is_admin());
create trigger audit_contract_templates after insert or update or delete on public.contract_templates
    for each row execute function public.fn_audit_write();

insert into public.contract_templates (body) values ($contract$SALES REPRESENTATIVE AGREEMENT

This Sales Representative Agreement ("Agreement") is made effective as of the date of electronic acceptance below, by and between Agile Medical Group, LLC ("Agile"), and the undersigned independent contractor ("Sales Representative").

1. PURPOSE
This Agreement outlines the terms by which the Sales Representative will promote Agile's medical products and services, support healthcare providers, and ensure compliance with all operational and legal requirements.

2. SALES REPRESENTATIVE DUTIES
The Sales Representative agrees to:
- Promote Agile's products and expand market presence within the assigned territory.
- Lead providers through the sales process using an AgileMedGroup.com email address.
- Maintain consistent communication with providers and document all interactions in the Agile CRM.
- Attend Agile meetings and respond promptly via Slack.
- Schedule and attend sales appointments and product presentations.
- Follow directives from Agile management and meet the quarterly sales quota of 32 cm².

3. ADDITIONAL RESPONSIBILITIES
Provider Training: Ensure all provider staff receive initial and recurring training on the safe use of products; coordinate training with Agile's Clinical Director and distribute all relevant materials.
Inventory Oversight: Track inventory by serial number to maintain full traceability; conduct periodic office inspections for proper storage and compliance; report any discrepancies immediately to Agile management.
Provider Support: Actively promote products and offer in-person support; serve as the primary point of contact for provider issues, escalating when necessary.
Compliance & Reporting: Educate providers on HIPAA, product traceability, and recall processes; attend mandatory compliance training; maintain accurate logs, submit provider feedback, and report concerns to the Clinical Director.
Failure to meet these responsibilities may result in disciplinary action or termination.

4. TERRITORY & ACCOUNT MANAGEMENT
- Sales efforts are limited to licensed states, regions, or assigned verticals.
- Accounts remain with the original Sales Representative if serviced within the prior 6 months and CRM activity is current.
- Accounts inactive for 6 months without documented outreach may be reassigned.
- Upon termination of this Agreement, all accounts revert to Agile.

5. PAYMENT AND COMMISSIONS
- Commissions are calculated and paid as outlined in Exhibit A (Compensation Model).
- Commissions accrue only on gross collected dollars; no commission is paid on uncollected or recovered collections, and refunds or recovered collections reverse previously accrued commission.
- Residual commissions are only paid to active Sales Representatives who: maintain CRM records and regular provider engagement; attend team meetings or give notice of absence; and meet quarterly sales quotas.
- Sales Representatives are paid through Gusto, which collects Form W-9 and issues Form 1099.

6. PROVIDER RESPONSIBILITIES NOTICE (FOR ACKNOWLEDGMENT PURPOSES)
Providers are expected to: track inventory by serial number; participate in required product training; report product use, adverse events, or complaints promptly; store products securely and limit access to trained staff; and cover costs for lost, expired, or untraceable inventory.

7. INDEPENDENT CONTRACTOR STATUS
The Sales Representative is not an employee of Agile. No taxes, benefits, insurance, or reimbursements will be provided by Agile. The Representative is responsible for all applicable taxes and must submit a W-9 (via Gusto). Agile will issue a 1099.

8. EXCLUSIVITY
During the term of this Agreement, the Sales Representative will sell only Agile-approved skin-substitute products and will not represent competing skin-substitute products without Agile's prior written consent.

9. LICENSING, INSURANCE, AND COMPLIANCE
The Representative must comply with all applicable laws and maintain required licenses; maintain auto liability and, if applicable, workers' compensation coverage; and provide proof of insurance upon request.

10. TERM AND TERMINATION
This Agreement is effective upon signing and remains in force until terminated. Either party may terminate with 30 days' written notice or immediately for cause. Upon termination, accounts revert to Agile and residual commissions cease.

11. LEGAL AND CONFIDENTIALITY PROVISIONS
Indemnification: Each party shall hold the other harmless from liabilities arising from this Agreement.
Confidentiality: All Agile and provider information must be kept confidential.
Proprietary Rights: All work product created using Agile's resources is the exclusive property of Agile.
Dispute Resolution: Disputes will be resolved in Sheridan County, Wyoming, by court or mutually agreed arbitration/mediation.
Severability: If any part of this Agreement is found invalid, the remainder will remain in effect.
Force Majeure: Performance is excused in cases of natural disasters, strikes, or other uncontrollable events.
Relationship of Parties: This Agreement does not create a partnership or employer-employee relationship.
Assignment: Sales Representative may not assign this Agreement without Agile's written consent.
Non-Solicitation: During the term and for one year thereafter, the Sales Representative will not solicit Agile employees or contractors.

12. ENTIRE AGREEMENT & MODIFICATIONS
This Agreement constitutes the full understanding between the parties and supersedes any prior agreements, including any prior versions of Exhibit A. Modifications must be in writing and signed by both parties.

EXHIBIT A — COMPENSATION MODEL

1. Pricing anchor. Product reimbursement is anchored at $127.00 per billable cm², versioned quarterly by Agile. Each order locks to the pricing version in effect on its order date.

2. Provider discount tiers. The Sales Representative may offer providers one of three discount tiers per order — 30%, 35%, or 40% off the reimbursement anchor (never exceeding 40%). The provider is billed the discounted amount per billable cm² (at $127.00: $88.90, $82.55, or $76.20 respectively).

3. Commission. For each order, net revenue equals the amount billed to the provider minus Agile's cost of goods. The Sales Representative earns SIXTY PERCENT (60%) of net revenue; Agile retains forty percent (40%).

4. Collection basis. Commission accrues only on gross collected dollars, in proportion to the amount collected. No commission accrues on invoiced-but-uncollected amounts. If a collection is refunded or recovered, the corresponding commission is reversed (clawback), including after payout.

5. Payment. Accrued commissions are paid through Gusto on Agile's regular payout schedule following collection.

6. Residuals & quota. Residual commissions on ongoing accounts require active status per Section 5 of the Agreement, including the quarterly sales quota of 32 cm².

ELECTRONIC ACCEPTANCE
By typing their name and accepting below, the Sales Representative agrees to all terms of this Agreement, including Exhibit A.$contract$);
