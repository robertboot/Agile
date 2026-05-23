// Import sales reps from the legacy Reps List.csv.
// Columns: Name, Cell, Agile Email, Date completed FDA training
// Idempotent: matches by email. Sends a magic-link invite for new reps.
// Run: pnpm migrate:reps [-- --file 'data/Reps List.csv' --commit]

import {
    DEFAULT_FILES,
    getServiceClient,
    loadSheet,
    looksLikeTestData,
    newReport,
    normalizeEmail,
    normalizePhone,
    parseLegacyDate,
    parseMigrateArgs,
    printReport,
} from "./_util.js";

interface RepRow {
    Name?: string | null;
    Cell?: string | null;
    "Agile Email"?: string | null;
    "Date completed FDA training"?: string | null;
}

async function main() {
    const opts = parseMigrateArgs(DEFAULT_FILES.reps);
    const rows = loadSheet<RepRow>(opts.file);
    const report = newReport("import-reps");
    const svc = getServiceClient();

    for (const [i, row] of rows.entries()) {
        const email = normalizeEmail(row["Agile Email"]);
        const name = row.Name?.toString().trim();

        if (!email || !name) {
            report.skipped++;
            continue;
        }
        if (looksLikeTestData(name, email)) {
            report.skipped++;
            continue;
        }

        const { data: existing } = await svc
            .from("profiles")
            .select("id, role")
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
            role: "rep",
            status: "pending",
            display_name: name,
            email,
            phone: normalizePhone(row.Cell),
            fda_training_completed_at: parseLegacyDate(row["Date completed FDA training"]),
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
