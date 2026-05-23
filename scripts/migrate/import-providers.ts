// Import providers from the historic-data spreadsheet.
// Idempotent: matches by email. Providers are created with status='pending'
// and become active when they sign in (Apple/Google/email) and either redeem
// an invite code or have an admin-seeded assignment via import-rep-provider-assignments.
// Run: pnpm migrate:providers -- --file data/agile-historic.xlsx [--commit]

import {
    getServiceClient,
    loadSheet,
    newReport,
    normalizeEmail,
    parseMigrateArgs,
    printReport,
} from "./_util.js";

const DEFAULT_SHEET = "Providers";

interface ProviderRow {
    Name?: string;
    Email?: string;
    Phone?: string;
    NPI?: string;
    Practice?: string;
    "Assigned Rep Email"?: string;
}

async function main() {
    const opts = parseMigrateArgs();
    const sheet = opts.sheet ?? DEFAULT_SHEET;
    const rows = loadSheet<ProviderRow>(opts.file, sheet);
    const report = newReport("import-providers");
    const svc = getServiceClient();

    for (const [i, row] of rows.entries()) {
        const email = normalizeEmail(row.Email);
        const name = row.Name?.trim();
        if (!email || !name) {
            report.failed++;
            report.failures.push({ row: i + 2, reason: "missing email or name", data: row });
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

        const { error: profileErr } = await svc.from("profiles").insert({
            id: invited.user.id,
            role: "provider",
            status: "pending",
            display_name: name,
            email,
            phone: row.Phone?.toString().trim() ?? null,
            npi: row.NPI?.toString().trim() ?? null,
            practice_name: row.Practice?.toString().trim() ?? null,
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
