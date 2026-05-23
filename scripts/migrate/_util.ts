// Shared utilities for migration scripts.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import * as XLSX from "xlsx";

export interface MigrateOptions {
    file: string;
    sheet?: string;
    commit: boolean;
}

export function parseMigrateArgs(): MigrateOptions {
    const { values } = parseArgs({
        options: {
            file: { type: "string", short: "f" },
            sheet: { type: "string", short: "s" },
            commit: { type: "boolean", default: false },
            "dry-run": { type: "boolean", default: false },
        },
    });
    if (!values.file) {
        throw new Error("Missing --file. Example: --file data/agile-historic.xlsx");
    }
    return {
        file: resolve(values.file),
        sheet: values.sheet,
        commit: Boolean(values.commit) && !values["dry-run"],
    };
}

export function loadSheet<T = Record<string, unknown>>(file: string, sheet?: string): T[] {
    const buf = readFileSync(file);
    const wb = XLSX.read(buf, { type: "buffer" });
    const sheetName = sheet ?? wb.SheetNames[0];
    if (!sheetName || !wb.Sheets[sheetName]) {
        throw new Error(`Sheet "${sheetName}" not found. Available: ${wb.SheetNames.join(", ")}`);
    }
    return XLSX.utils.sheet_to_json<T>(wb.Sheets[sheetName]);
}

export function listSheets(file: string): string[] {
    const buf = readFileSync(file);
    return XLSX.read(buf, { type: "buffer" }).SheetNames;
}

export function getServiceClient(): SupabaseClient {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        throw new Error(
            "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env before running migrations.",
        );
    }
    return createClient(url, key, { auth: { persistSession: false } });
}

export interface ReconciliationReport {
    name: string;
    inserted: number;
    skipped: number;
    failed: number;
    failures: Array<{ row: number; reason: string; data?: unknown }>;
}

export function newReport(name: string): ReconciliationReport {
    return { name, inserted: 0, skipped: 0, failed: 0, failures: [] };
}

export function printReport(r: ReconciliationReport, dryRun: boolean): void {
    const banner = dryRun ? "DRY RUN — no DB writes" : "COMMITTED";
    console.log(`\n=== ${r.name} (${banner}) ===`);
    console.log(`  inserted: ${r.inserted}`);
    console.log(`  skipped:  ${r.skipped}`);
    console.log(`  failed:   ${r.failed}`);
    if (r.failures.length > 0) {
        console.log("  failures:");
        for (const f of r.failures.slice(0, 20)) {
            console.log(`    row ${f.row}: ${f.reason}`);
        }
        if (r.failures.length > 20) console.log(`    … and ${r.failures.length - 20} more`);
    }
}

export function normalizeEmail(s: unknown): string | null {
    if (typeof s !== "string") return null;
    const trimmed = s.trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : null;
}
