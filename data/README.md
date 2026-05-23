# /data — Historic data files

**This folder is gitignored.** Files placed here never enter git history.

## Files expected here

The migration scripts default to these paths, which match the legacy CSV export filenames from `main`:

```
data/Reps List.csv
data/Registered Providers.csv
data/All Orders.csv
data/Product_Pricing Report.csv     (Phase 2)
data/Commission_Tracker Report.csv  (Phase 2)
data/Products.csv                   (Phase 2; superseded by Product_Pricing Report.csv)
```

Drop the files here exactly as named (with spaces). Pass `--file <other-path>` to override the default for any script.

## Column expectations (reverse-engineered from the legacy CSVs)

### Reps List.csv
| Column | Maps to | Notes |
|---|---|---|
| `Name` | `profiles.display_name` | |
| `Cell` | `profiles.phone` | Normalized to `+1NNNNNNNNNN`; `-` and empty → null |
| `Agile Email` | `profiles.email` | Lowercased, validated |
| `Date completed FDA training` | `profiles.fda_training_completed_at` | Format: `17-Sep-2025` → `2025-09-17` |

### Registered Providers.csv
| Column | Maps to | Notes |
|---|---|---|
| `Contact Name` | `profiles.office_contact_name` | Office contact, not the doctor |
| `Contact Email` | `profiles.email` | |
| `Contact Phone Number` | `profiles.phone` | |
| `Practice Name` | `profiles.practice_name` | |
| `Practice Provider` | `profiles.display_name` | The actual physician |
| `Location Address` | `profiles.practice_address` | Single-line; not parsed in v1 |
| `Signature` | `profiles.signature_path` | Filename reference only |
| `Approve/Reject` | `profiles.status` + `profiles.legacy_approval_status` | Approved → active, Rejected → suspended |

### All Orders.csv (Phase 1: used for rep ↔ provider derivation only)
| Column | Use |
|---|---|
| `RequestedbyEmail` | The rep who placed the order — drives the assignment |
| `Practice Name` | Looked up against existing provider profiles |
| `Practice Provider` | Sanity check (not used for lookup; same practice can have one doctor) |

Phase 2 will fully import orders, line items (`Product | cm² | price | SKU/lot`), invoices, and payments.

### Product_Pricing Report.csv (Phase 2)
Columns: `Product ID`, `Product Name`, `Unit Price`, `Effective_Date`, `Commission_25/30/35/40` (commission tiers).

### Commission_Tracker Report.csv (Phase 2)
Columns: `Commission_ID`, `Order`, `Add Rep Form` (rep email), `Provider Registration Form`, `Products`, `Commission_Amount`, `Status`, `Date_Earned`, `Date_Paid`.

## How to run

Dry-run by default (no DB writes):

```bash
pnpm migrate:reps
pnpm migrate:providers
pnpm migrate:assignments
```

Commit for real:

```bash
pnpm migrate:reps -- --commit
pnpm migrate:providers -- --commit
pnpm migrate:assignments -- --commit
```

## Why gitignored

The legacy CSVs contain rep and provider PII (names, emails, NPIs, addresses, phone numbers) and were already committed to `main`'s git history before this rebuild. The new layout keeps the data out of any future commit. Cleaning the PII from existing git history requires `git filter-repo` + force-push to `main` and is tracked as a separate follow-up.

## Order of imports (matters)

1. `pnpm migrate:reps` — creates rep `profiles` rows + sends each rep an onboarding magic link.
2. `pnpm migrate:providers` — creates provider `profiles` rows with status reflecting the legacy approve/reject decision.
3. `pnpm migrate:assignments` — derives rep ↔ provider links from `All Orders.csv` (`RequestedbyEmail` × `Practice Name`).

## Safety

- All scripts are idempotent — rerunning won't duplicate. Reps/providers match by email; assignments match by `(rep_id, provider_id)`.
- Obvious test rows (names containing "test", placeholder emails, `5555555555` phone numbers) are skipped automatically.
- Scripts produce a reconciliation summary in stdout; failures are listed by row number for easy spot-checking.
- A future enhancement can write the full failure list to `/tmp/migrate-{name}-{timestamp}.json` if the count grows.
