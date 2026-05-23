// Derive rep ↔ provider assignments from the legacy All Orders.csv.
//
// The legacy Registered Providers sheet does NOT have a rep column. The
// authoritative source of rep → provider mappings is the orders log, where
// each order has:
//   - RequestedbyEmail  → the rep's email
//   - Practice Name     → the practice (used as the lookup key for the provider)
//   - Practice Provider → the doctor's display name (sanity check)
//
// We deduplicate (rep_email, practice_name) pairs, look up the matching
// provider profile (by practice_name), and seed a rep_provider_assignments
// row. Source = 'migration'.
//
// Run AFTER import-reps and import-providers.
// Idempotent: matches by (rep_id, provider_id) pair.
//
// Run: pnpm migrate:assignments [-- --file 'data/All Orders.csv' --commit]

import {
    DEFAULT_FILES,
    getServiceClient,
    loadSheet,
    newReport,
    normalizeEmail,
    parseMigrateArgs,
    printReport,
} from "./_util.js";

interface OrderRow {
    Status?: string | null;
    "Order ID"?: string | null;
    "Practice Name"?: string | null;
    "Practice Provider"?: string | null;
    RequestedbyEmail?: string | null;
}

async function main() {
    const opts = parseMigrateArgs(DEFAULT_FILES.orders);
    const rows = loadSheet<OrderRow>(opts.file);
    const report = newReport("import-rep-provider-assignments");
    const svc = getServiceClient();

    // Step 1: dedupe (rep_email, practice_name) pairs from the orders log.
    const pairs = new Map<string, { repEmail: string; practiceName: string }>();
    for (const row of rows) {
        const repEmail = normalizeEmail(row.RequestedbyEmail);
        const practiceName = row["Practice Name"]?.toString().trim();
        if (!repEmail || !practiceName) continue;
        const key = `${repEmail}::${practiceName.toLowerCase()}`;
        if (!pairs.has(key)) {
            pairs.set(key, { repEmail, practiceName });
        }
    }

    // Cache lookups so we hit the DB once per email / practice.
    const repCache = new Map<string, string | null>();
    const providerCache = new Map<string, string | null>();

    async function findRepId(email: string): Promise<string | null> {
        if (repCache.has(email)) return repCache.get(email)!;
        const { data } = await svc
            .from("profiles")
            .select("id, role")
            .eq("email", email)
            .maybeSingle();
        const id = data && data.role === "rep" ? data.id : null;
        repCache.set(email, id);
        return id;
    }

    async function findProviderId(practiceName: string): Promise<string | null> {
        const key = practiceName.toLowerCase();
        if (providerCache.has(key)) return providerCache.get(key)!;
        // Practice name matching is case-insensitive. If multiple providers share
        // a practice name (shouldn't happen in this dataset), prefer the most
        // recently active one.
        const { data } = await svc
            .from("profiles")
            .select("id, role, status, practice_name")
            .ilike("practice_name", practiceName)
            .eq("role", "provider")
            .order("status", { ascending: true }) // 'active' < 'pending' < 'suspended' alphabetically — adjust if surprising
            .limit(1)
            .maybeSingle();
        const id = data?.id ?? null;
        providerCache.set(key, id);
        return id;
    }

    let pairIndex = 0;
    for (const { repEmail, practiceName } of pairs.values()) {
        pairIndex++;
        const repId = await findRepId(repEmail);
        const providerId = await findProviderId(practiceName);

        if (!repId) {
            report.failed++;
            report.failures.push({
                row: pairIndex,
                reason: `rep not found: ${repEmail}`,
            });
            continue;
        }
        if (!providerId) {
            report.failed++;
            report.failures.push({
                row: pairIndex,
                reason: `provider not found for practice: ${practiceName}`,
            });
            continue;
        }

        const { data: existing } = await svc
            .from("rep_provider_assignments")
            .select("id")
            .eq("rep_id", repId)
            .eq("provider_id", providerId)
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
            rep_id: repId,
            provider_id: providerId,
            source: "migration",
            active: true,
        });
        if (error) {
            report.failed++;
            report.failures.push({
                row: pairIndex,
                reason: `insert failed: ${error.message}`,
            });
            continue;
        }
        report.inserted++;
    }

    console.log(
        `\nDerived ${pairs.size} unique (rep, practice) pairs from ${rows.length} orders.`,
    );
    printReport(report, !opts.commit);
    if (!opts.commit) {
        console.log("\nRe-run with --commit to actually write to the database.\n");
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
