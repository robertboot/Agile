# Agile RCM

Provider credentialing and payer enrollment. Deployed at **rcm.agilemedgroup.com**.

A separate site from the wound-care portal (`apps/web`), on purpose: separate people,
separate login, separate data. The design reasoning is in
[`docs/credentialing/README.md`](../../docs/credentialing/README.md).

## What is and is not shared with the portal

| | |
|---|---|
| Shared | The Supabase project, so one `auth.users` pool and one `profiles` row per person |
| Not shared | The session. Different host, different cookie jar — signing in here does not sign you in to the portal, and signing out of one leaves the other alone |
| Not shared | Authorization. Access comes from `credentialing.staff`, never from the portal's `user_role`. A rep has no row and therefore no access |
| Not shared | The data. Everything lives in the `credentialing` schema; this app never reads orders, commissions or margins |

## Pages

| Route | What it does |
|---|---|
| `/login` | Sign in. A portal account that is not credentialing staff is turned away here |
| `/console` | Work queue — four dispositions, the three follow-up lists, and the organization list |
| `/console/[orgId]` | One organization: locations with their effective Type 2 NPI, providers, every enrollment, and the forms that add to them |
| `/console/batches/[batchId]` | Records one payer decision, with an outcome per product — batches come back mixed |
| `/console/staff` | Who may use this site. Managers and owners only |

## Access

`credentialing.staff` (migration `20260917000001`) holds it. Three roles:

- **specialist** — does the credentialing work
- **manager** — a specialist who can also add and remove people
- **owner** — a manager who can also change payer reference data

A portal admin is let in as well, so an empty list is not a lockout on day one. Seed the
first real row by hand:

```sql
insert into credentialing.staff (profile_id, role)
select id from public.profiles where email = 'you@agilemedgroup.com';
```

After that, managers add the rest from `/console/staff`.

Adding someone grants access; it does not create a login. They need an Agile account
first, because identity is still the shared pool.

## Environment

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Same project as the portal |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same project as the portal |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-only.** Never expose it to the browser |

The service-role key is load-bearing here in a way it is not in the portal: every
credentialing read and write goes through it, behind `requireStaff()`. That is deliberate
and temporary — credentialing rows are not yet reachable by the people they describe,
because `DESIGN-CORRECTIONS.md` §5.3/§5.4 walls provider-private data off from the billing
party and that consent model is not designed. Until it is, the only reader is a staff
member and a staff member may read everything, so authorization lives in the app layer.
`credentialing.staff` exists in the database too, so the same rule holds for anyone who
reaches the data another way.

## Local development

```bash
npm install
npm run dev:rcm     # http://localhost:3200
```

The portal runs on 3100, so both can run at once.

## Deploying

This is a second Vercel project pointing at the same repository, with
**Root Directory = `apps/rcm`**. It needs its own environment variables (the three above)
and a `rcm.agilemedgroup.com` domain with the CNAME Vercel gives you.

Nothing here changes how `apps/web` deploys.
