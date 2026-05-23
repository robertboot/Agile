# /data — Historic data spreadsheet

**This folder is gitignored.** Files placed here never enter git history.

## What goes here

Place your historic-data spreadsheet (the one tracking products, providers + reps, sales reps + commission rates, and historic orders + payments) here:

```
/data/agile-historic.xlsx
```

or whatever filename you prefer. The migration scripts in `/scripts/migrate/` read from this folder by convention.

## Why gitignored

The spreadsheet contains rep and provider PII (names, emails, NPIs, addresses). Per HIPAA risk posture, this never enters a git repository — git history is permanent and difficult to scrub.

If you ever need to share a sanitized sample with collaborators, create `/data/sample-sanitized.xlsx` with names replaced by placeholders (`rep_001`, `provider_017`) and explicitly commit it with `git add -f data/sample-sanitized.xlsx`. Do not sanitize and commit the real file — even one accidental row leaks PII forever.

## Expected sheets / columns

The migration scripts expect (will be refined once the actual file is added):

- **Reps**: name, email, phone, default_commission_pct_or_cents_per_cm2
- **Providers**: name, email, phone, npi (optional), practice_name, address, assigned_rep_email
- **Products**: name, sku, manufacturer, unit_price_cents OR area_pricing_cents_per_cm2, active
- **Orders** (Phase 2): order_id, date, provider_email, rep_email, line items (product, area_cm2, price), status, payment status

See `/scripts/migrate/README.md` for column-mapping details once written.

## Reading it during development

The migration scripts use `xlsx` (SheetJS) to read the workbook. To run a dry-run against your file:

```bash
pnpm migrate:reps -- --dry-run --file data/agile-historic.xlsx
```

The dry-run produces a reconciliation report and writes nothing to the database.
