// Shared utilities for migration scripts.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { extname, resolve } from "node:path";
import { parseArgs } from "node:util";
import * as XLSX from "xlsx";

export interface MigrateOptions {
    file: string;
    sheet?: string;
    commit: boolean;
}

/** Default file locations matching the legacy CSV exports. */
export const DEFAULT_FILES = {
    reps: "data/Reps List.csv",
    providers: "data/Registered Providers.csv",
    orders: "data/All Orders.csv",
    products: "data/Product_Pricing Report.csv",
    commissions: "data/Commission_Tracker Report.csv",
} as const;

export function parseMigrateArgs(defaultFile: string): MigrateOptions {
    const { values } = parseArgs({
        options: {
            file: { type: "string", short: "f" },
            sheet: { type: "string", short: "s" },
            commit: { type: "boolean", default: false },
            "dry-run": { type: "boolean", default: false },
        },
    });
    const file = values.file ?? defaultFile;
    return {
        file: resolve(file),
        sheet: values.sheet,
        commit: Boolean(values.commit) && !values["dry-run"],
    };
}

export function loadSheet<T = Record<string, unknown>>(file: string, sheet?: string): T[] {
    const buf = readFileSync(file);
    const ext = extname(file).toLowerCase();
    const readType = ext === ".csv" ? "string" : "buffer";
    const wb = XLSX.read(readType === "string" ? buf.toString("utf8") : buf, {
        type: readType,
        raw: false, // let xlsx parse dates / numbers
    });
    const sheetName = sheet ?? wb.SheetNames[0];
    if (!sheetName || !wb.Sheets[sheetName]) {
        throw new Error(`Sheet "${sheetName}" not found. Available: ${wb.SheetNames.join(", ")}`);
    }
    return XLSX.utils.sheet_to_json<T>(wb.Sheets[sheetName], { defval: null });
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

/** Normalize phone numbers to a consistent shape. Returns null for missing/invalid. */
export function normalizePhone(s: unknown): string | null {
    if (s == null) return null;
    const str = String(s).trim();
    if (!str || str === "-") return null;
    const digits = str.replace(/\D/g, "");
    if (digits.length < 7) return null;
    // US numbers: prefix with +1 if 10 digits, keep as-is if already 11 starting with 1.
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
    return `+${digits}`;
}

/** Parse "17-Sep-2025" → ISO date string "2025-09-17". Returns null on failure. */
export function parseLegacyDate(s: unknown): string | null {
    if (!s) return null;
    const str = String(s).trim();
    if (!str) return null;
    const months: Record<string, string> = {
        jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
        jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
    };
    const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(str);
    if (m) {
        const month = months[m[2].toLowerCase()];
        if (!month) return null;
        return `${m[3]}-${month}-${m[1].padStart(2, "0")}`;
    }
    // Fallback: let Date parse it.
    const d = new Date(str);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
}

/** Map legacy approval label to our user_status enum. */
export function mapApprovalToStatus(approve: unknown): "pending" | "active" | "suspended" {
    const s = String(approve ?? "").trim().toLowerCase();
    if (s === "approved") return "active";
    if (s === "rejected") return "suspended";
    return "pending";
}

export function looksLikeTestData(...fields: Array<unknown>): boolean {
    const joined = fields.map((f) => String(f ?? "").toLowerCase()).join(" ");
    return /\btest\b|placeholder|\bjlh\b|55{4,}/i.test(joined);
}
