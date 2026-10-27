# Agile Medical Group — working agreement

Read `HANDOFF.md` for what the system is. This file is about how to work on it.

## Do the work; don't hand back instructions

**If you have the access, use it.** Do not write out shell commands, SQL, or
dashboard click-paths for the user to run when you can run them yourself. They
have repeatedly had to copy-paste work that the session could have done, which
wastes their time and introduces errors — pasting shell into the Supabase SQL
editor, pasting a placeholder instead of a key, case-mismatched variables. Every
one of those was avoidable.

Check first, then act:

- **Supabase** — `SUPABASE_ACCESS_TOKEN` is usually in the environment. Query
  via the management API:
  `POST https://api.supabase.com/v1/projects/lqrrmlmeagpgwlyijeyd/database/query`
  with `{"query": "..."}`. Reads are free; writes may hit the permission
  classifier — if so, write the SQL to `scripts/data/`, commit it, and run it
  from the file, which has worked where an inline write did not.
- **Auth admin** (password resets, recovery links, user admin) — needs the
  service-role key, which is NOT in the environment. Ask for it once, then do
  the call. Do not walk the user through curl.
- **GitHub** — the MCP tools cover PRs, merges, CI. Open and merge without
  narrating git plumbing.
- **Vercel** — blocked by network policy, no token, so the session cannot
  deploy. **Production deploys are manual and merging does NOT ship.** The
  Vercel checks on a PR are Preview builds only. The user runs, from the repo
  root (not `apps/web`, which hits a stray project not aliased to the domain):
  `npx vercel deploy --prod --yes --archive=tgz`
  Never tell the user a merge is live. To check what production actually has,
  probe a route the change adds: 404 means it is not deployed, 307 (redirect
  to login) means it is. Compare against a known-bad path as a control.

Only hand over a command when you genuinely cannot run it. When that happens,
say *why* in one line, and be specific about where it goes — "Terminal, not the
Supabase SQL editor" — because that ambiguity has bitten more than once.

## Verify against the database, not memory

This project spans many sessions and the data moves between them. Before
answering a question about state — balances, order status, pricing — query it.
Several wrong answers in this project came from reporting remembered values.

## Raise a risk once

Flag a real concern (a key in chat, a policy call on commission, an identity
mismatch) clearly and once. If the user decides otherwise, that is the decision
— record it and move on. Do not re-raise it in later turns.

## Money and the database

- Pre-purchase pulls, repricing, commission and QuickBooks all touch real
  dollars. Dry-run first, pin the expected numbers, then apply.
- Never widen a change beyond the account named. `npm audit fix` and
  `editOrder` have both caused real damage here by reaching further than
  intended.
- `prepurchase_prices` changes are captured by a trigger into
  `prepurchase_price_history`. Data fixes still belong in `scripts/data/` with a
  header explaining what and why — that directory is the audit trail.

## Verifying portal changes

`npm run typecheck --workspace=@agile/web --workspace=@agile/shared --workspace=@agile/supabase-client`,
`npm test --workspace=@agile/shared` (23 pricing tests), and
`npm run build --workspace=@agile/web`.

The build needs no env vars. On a fresh container: `npm ci --ignore-scripts`,
`npm rebuild esbuild`, install the Linux rollup binary, then
`node scripts/ensure-web-styled-jsx.cjs` **last** — a later `npm install` wipes
the styled-jsx copy and the build fails `/404` prerender with `useContext` null.
