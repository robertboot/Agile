# Email vendor: Postmark vs AWS SES

Decision needed: which transactional email provider does Agile use for magic links, invite codes, PDF-export notifications, and admin onboarding?

Both providers can sign a HIPAA Business Associate Agreement. Both deliver transactional email reliably. The decision is about operational fit, not capability.

## Recommendation

**Postmark.** Switch to SES later if monthly volume exceeds ~50k emails or AWS consolidation becomes valuable for other reasons.

## Side-by-side

| | **Postmark** | **AWS SES** |
|---|---|---|
| **BAA** | Yes — explicit HIPAA addendum on the Outbound plan. Sign in the Postmark dashboard. | Yes — covered by the AWS BAA. Must explicitly enable HIPAA-eligible services in AWS Organizations. |
| **Pricing at our scale** | Starter $15/mo for 10k emails. ~$0.0015 per email after. | $0.10 per 1k emails. ~$0.0001 per email. Plus $0.12 per GB of attachments. |
| **Realistic Phase 1 cost** | ~$15/mo flat | < $1/mo |
| **Deliverability** | Excellent — dedicated transactional reputation. | Good — requires DKIM, SPF, DMARC setup. Sandbox-by-default; need explicit production access. |
| **Setup time** | 30 min: verify domain, copy API key, done. | 2–4 hours: domain identity, DKIM keys, request production access, configure SNS for bounces. |
| **Webhooks** | Delivery, bounce, open, click, complaint — all first-class with retry. | Bounce + complaint via SNS topic. Delivery/open require additional event-source config. |
| **SDK** | REST + JS / Python / .NET clients. | AWS SDK v3 (already in many Node stacks). |
| **Dashboard / observability** | Per-message timeline, search by recipient, replay. | CloudWatch metrics + S3 logs. Powerful but you assemble it. |
| **Template management** | Built-in template editor with variables and inheritance. | Templates via API; no GUI. |
| **Domain warm-up** | Not needed at our volume. | Suggested for new sending identities. |
| **Spam classification** | Postmark separates transactional from broadcast (rejects bulk on transactional servers). Reduces shared-IP risk. | Shared by default; dedicated IPs available. |
| **Inbound** | Optional ($10/mo) — useful if you want reply-to support. | SES inbound writes to S3; works but engineering-heavy. |
| **Vendor lock-in** | Low — SMTP interface available; switch any time. | Low — SDK calls but SMTP also works. |

## When SES makes sense instead

- Volume crosses ~50k emails/month and the $15 flat fee becomes more expensive than per-email pricing.
- You're already running on AWS and want one BAA, one bill, one console.
- You want to integrate email into a larger event-driven architecture (Lambda + S3 + SNS).
- Compliance officer prefers a single BAA from a single vendor for the entire stack.

## Cost projection

Assumptions: 1 magic link / signup, 1 invite redemption / new provider, 5 export notifications / active provider / month, 1 admin email / week.

| Scenario | Emails/mo (rough) | Postmark | SES |
|---|---|---|---|
| 10 active providers, 5 reps | ~75 | $15 (flat) | < $0.01 |
| 50 active providers, 15 reps | ~400 | $15 (flat) | $0.04 |
| 200 active providers, 50 reps | ~1,600 | $15 (flat) | $0.16 |
| 500 active providers, 100 reps | ~4,000 | $15 (flat) | $0.40 |
| 2,000 active providers, 200 reps | ~15,000 | $30 (next tier) | $1.50 |

Postmark is more expensive per email but the time saved on setup (and the human cost of debugging deliverability) easily pays for the first ~12 months.

## What to do once a decision is made

1. Sign the BAA via the vendor's standard process.
2. Add credentials to the Supabase project's secrets (Supabase Auth has a built-in SMTP configuration that supports both).
3. Configure a sender domain (e.g., `noreply@agile.<final-brand>.com`) with SPF, DKIM, and DMARC.
4. Update `/docs/hipaa/baa-matrix.md` with the chosen vendor + signed date.
5. Send a test magic link from `agile-staging` to your own inbox and confirm:
   - Delivered to inbox, not spam.
   - SPF, DKIM, DMARC all pass (use a tool like mail-tester.com).
   - The link works.

## Open items

- **Sending domain** — depends on the final brand name (open item #10 in the plan).
- **Reply-to address** — likely a Postmark-routed inbox or a Google Workspace BAA-covered mailbox so providers can reply with questions.
- **Bounce/complaint handling** — both providers expose webhooks; the `audit_log` should ingest these events so we know if a provider's address has gone bad.
