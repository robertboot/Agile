// Import providers from the legacy Registered Providers.csv.
// Columns: Contact Name, Contact Email, Contact Phone Number, Practice Name,
//          Practice Provider, Location Address, Signature, Approve/Reject
//
// Notes on the data model mapping:
//   - "Practice Provider" is the actual provider/physician → display_name.
//   - "Contact Name" is the office contact who handled registration →
//     stored separately in profiles.office_contact_name.
//   - Address is a single line; we don't parse street/city/state/zip in v1.
//   - "Approve/Reject" maps to profiles.status (Approved → active,
//     Rejected → suspended) AND is preserved in legacy_approval_status.
//
// Idempotent: matches by email.
// Run: pnpm migrate:providers [-- --file 'data/Registered Providers.csv' --commit]

import {
    DEFAULT_FILES,
    getServiceClient,
    loadSheet,
    looksLikeTestData,
    mapApprovalToStatus,
    newReport,
    normalizeEmail,
    normalizePhone,
    parseMigrateArgs,
    printReport,
} from "./_util.js";

interface ProviderRow {
    "Contact Name"?: string | null;
    "Contact Email"?: string | null;
    "Contact Phone Number"?: string | null;
    "Practice Name"?: string | null;
    "Practice Provider"?: string | null;
    "Location Address"?: string | null;
    Signature?: string | null;
    "Approve/Reject"?: string | null;
}

async function main() {
    const opts = parseMigrateArgs(DEFAULT_FILES.providers);
    const rows = loadSheet<ProviderRow>(opts.file);
    const report = newReport("import-providers");
    const svc = getServiceClient();

    for (const [i, row] of rows.entries()) {
        const email = normalizeEmail(row["Contact Email"]);
        const practiceProvider = row["Practice Provider"]?.toString().trim();
        const practiceName = row["Practice Name"]?.toString().trim();
        const officeContact = row["Contact Name"]?.toString().trim() || null;

        if (!email) {
            report.skipped++;
            continue;
        }
        // The display_name is the practitioner. Fall back to office contact if missing.
        const displayName = practiceProvider || officeContact;
        if (!displayName) {
            report.failed++;
            report.failures.push({
                row: i + 2,
                reason: "row has no Practice Provider and no Contact Name",
                data: row,
            });
            continue;
        }
        if (looksLikeTestData(displayName, email, practiceName)) {
            report.skipped++;
            continue;
        }

        const { data: existing } = await svc
            .from("profiles")
            .select("id, role")
            .eq("email", email)
            .maybeSingle();

        if (existing) {
            if (existing.role !== "provider") {
                report.failed++;
                report.failures.push({
                    row: i + 2,
                    reason: `email already exists with role=${existing.role}`,
                });
            } else {
                report.skipped++;
            }
            continue;
        }

        if (!opts.commit) {
            report.inserted++;
            continue;
        }

        const { data: invited, error: inviteErr } = await svc.auth.admin.inviteUserByEmail(email);
        if (inviteErr || !invited.user) {
            report.failed++;
            report.failures.push({ row: i + 2, reason: `invite failed: ${inviteErr?.message}` });
            continue;
        }

        const approval = row["Approve/Reject"]?.toString().trim() || null;
        const { error: profileErr } = await svc.from("profiles").insert({
            id: invited.user.id,
            role: "provider",
            status: mapApprovalToStatus(approval),
            display_name: displayName,
            email,
            phone: normalizePhone(row["Contact Phone Number"]),
            practice_name: practiceName ?? null,
            office_contact_name: officeContact,
            practice_address: row["Location Address"]?.toString().trim() || null,
            signature_path: row.Signature?.toString().trim() || null,
            legacy_approval_status:
                approval === "Approved" ? "Approved" : approval === "Rejected" ? "Rejected" : null,
        });
        if (profileErr) {
            report.failed++;
            report.failures.push({ row: i + 2, reason: `profile insert failed: ${profileErr.message}` });
            continue;
        }
        report.inserted++;
    }

    printReport(report, !opts.commit);
    if (!opts.commit) {
        console.log("\nRe-run with --commit to actually write to the database.\n");
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
