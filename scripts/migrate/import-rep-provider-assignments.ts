// Seed rep_provider_assignments from the spreadsheet so existing providers
// see their rep immediately on first login (skipping the invite-code dance).
// Idempotent: matches by (rep_id, provider_id) pair.
// Run AFTER import-reps and import-providers.
// Run: pnpm migrate:assignments -- --file data/agile-historic.xlsx [--commit]

import {
    getServiceClient,
    loadSheet,
    newReport,
    normalizeEmail,
    parseMigrateArgs,
    printReport,
} from "./_util.js";

const DEFAULT_SHEET = "Providers"; // Assigned-rep column lives on the Providers sheet.

interface ProviderRow {
    Email?: string;
    "Assigned Rep Email"?: string;
}

async function main() {
    const opts = parseMigrateArgs();
    const sheet = opts.sheet ?? DEFAULT_SHEET;
    const rows = loadSheet<ProviderRow>(opts.file, sheet);
    const report = newReport("import-rep-provider-assignments");
    const svc = getServiceClient();

    // Cache profile lookups to avoid N round-trips.
    const profileCache = new Map<string, { id: string; role: string } | null>();
    async function findProfile(email: string) {
        if (profileCache.has(email)) return profileCache.get(email)!;
        const { data } = await svc.from("profiles").select("id, role").eq("email", email).maybeSingle();
        profileCache.set(email, data ?? null);
        return data ?? null;
    }

    for (const [i, row] of rows.entries()) {
        const provEmail = normalizeEmail(row.Email);
        const repEmail = normalizeEmail(row["Assigned Rep Email"]);
        if (!provEmail || !repEmail) {
            report.skipped++; // not all providers have a rep
            continue;
        }
        const prov = await findProfile(provEmail);
        const rep = await findProfile(repEmail);
        if (!prov || prov.role !== "provider") {
            report.failed++;
            report.failures.push({ row: i + 2, reason: `provider not found or wrong role: ${provEmail}` });
            continue;
        }
        if (!rep || rep.role !== "rep") {
            report.failed++;
            report.failures.push({ row: i + 2, reason: `rep not found or wrong role: ${repEmail}` });
            continue;
        }

        const { data: existing } = await svc
            .from("rep_provider_assignments")
            .select("id")
            .eq("rep_id", rep.id)
            .eq("provider_id", prov.id)
            .eq("active", true)
            .maybeSingle();

        if (existing) {
            report.skipped++;
            continue;
        }

        if (!opts.commit) {
            report.inserted++;
            continue;
        }

        const { error } = await svc.from("rep_provider_assignments").insert({
            rep_id: rep.id,
            provider_id: prov.id,
            source: "migration",
            active: true,
        });
        if (error) {
            report.failed++;
            report.failures.push({ row: i + 2, reason: `insert failed: ${error.message}` });
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
