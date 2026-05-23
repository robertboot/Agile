# Breach Response Runbook

Activates when a confidentiality, integrity, or availability incident affects PHI. HIPAA defines a breach broadly; assume any unauthorized access, lost device, or suspected exfiltration triggers this runbook.

## Roles

- **HIPAA Security Officer** — incident commander. **TODO: designate.**
- **HIPAA Privacy Officer** — owns external comms + notification letters. **TODO: designate.**
- **Engineering on-call** — investigates, contains, preserves evidence.

## Phase 1: Detect & contain (within 4 hours)

1. Engineering on-call confirms the incident is real (rule out false positives).
2. Identify scope: which records, how many individuals, what fields.
3. Contain: revoke compromised credentials, rotate Supabase service-role key, suspend affected user accounts.
4. Preserve evidence: snapshot Supabase audit_log, freeze relevant partitions, capture access logs from Supabase dashboard.
5. Notify Security Officer + Privacy Officer.

## Phase 2: Assess (within 24 hours)

Use the four-factor test under 45 CFR 164.402 to determine if the incident is a "reportable breach":

1. **Nature and extent of PHI**: which identifiers, how sensitive.
2. **Identity of recipient**: was the recipient another covered entity (lower risk) or unknown (higher risk).
3. **Acquisition or viewing**: was the data actually accessed or merely accessible.
4. **Mitigation**: was the risk mitigated (e.g., the unauthorized party signed an attestation of destruction).

Document the assessment. If risk is low, document why and stop. Otherwise → Phase 3.

## Phase 3: Notify

### Affected individuals (60-day window)

Send written notice within 60 days of discovery. Include:
- What happened, when.
- Types of information involved.
- Steps individuals can take.
- What we're doing.
- Contact info.

### HHS

- **< 500 individuals**: log in the HHS portal; report annually in batches.
- **≥ 500 individuals**: notify HHS within 60 days.

### Media

If ≥ 500 individuals in a single state, notify prominent media outlets in that state within 60 days.

### Business Associates / vendors

If a BAA partner caused the breach, they're required to notify us under their BAA. Confirm receipt of their breach notice and coordinate.

## Phase 4: Remediate

- Root-cause analysis. Document findings.
- Implement corrective controls (e.g., new RLS policy, new audit rule, MFA enforcement).
- Update this runbook with any process gaps surfaced.
- Schedule retrospective with Security + Privacy Officers within 14 days.

## Tabletop exercise

Run annually. Pick a realistic scenario (lost rep iPhone with active session, RLS bypass via PostgREST filter, accidental commit of /data/ spreadsheet). Time the response. Document gaps.

## Templates

Store notification letter templates and HHS portal screenshots in `/docs/runbooks/breach-templates/` (not yet committed — will be added with legal review).
