// Import sales reps from the historic-data spreadsheet.
// Idempotent: matches by email. Sends a magic-link invite for new reps.
// Run: pnpm migrate:reps -- --file data/agile-historic.xlsx [--commit]

import {
    getServiceClient,
    loadSheet,
    newReport,
    normalizeEmail,
    parseMigrateArgs,
    printReport,
} from "./_util.js";

// Adjust this to match the actual sheet name once the spreadsheet is in /data/.
const DEFAULT_SHEET = "Reps";

interface RepRow {
    Name?: string;
    Email?: string;
    Phone?: string;
    "Commission %"?: number | string;
    "Commission $/cm²"?: number | string;
}

async function main() {
    const opts = parseMigrateArgs();
    const sheet = opts.sheet ?? DEFAULT_SHEET;
    const rows = loadSheet<RepRow>(opts.file, sheet);
    const report = newReport("import-reps");
    const svc = getServiceClient();

    for (const [i, row] of rows.entries()) {
        const email = normalizeEmail(row.Email);
        const name = row.Name?.trim();
        if (!email || !name) {
            report.failed++;
            report.failures.push({ row: i + 2, reason: "missing email or name", data: row });
            continue;
        }

        // Check existing.
        const { data: existing } = await svc
            .from("profiles")
            .select("id, email, role")
            .eq("email", email)
            .maybeSingle();

        if (existing) {
            if (existing.role !== "rep") {
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
            report.inserted++; // counts as "would insert"
            continue;
        }

        // Create auth user via invite (sends magic link).
        const { data: invited, error: inviteErr } = await svc.auth.admin.inviteUserByEmail(email);
        if (inviteErr || !invited.user) {
            report.failed++;
            report.failures.push({ row: i + 2, reason: `invite failed: ${inviteErr?.message}` });
            continue;
        }

        const { error: profileErr } = await svc.from("profiles").insert({
            id: invited.user.id,
            role: "rep",
            status: "pending",
            display_name: name,
            email,
            phone: row.Phone?.toString().trim() ?? null,
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
