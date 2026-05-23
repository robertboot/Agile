import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types.js";

export interface SupabaseConfig {
    url: string;
    anonKey: string;
    /** Optional secure storage adapter (e.g., expo-secure-store wrapper for React Native). */
    storage?: {
        getItem: (key: string) => Promise<string | null>;
        setItem: (key: string, value: string) => Promise<void>;
        removeItem: (key: string) => Promise<void>;
    };
}

export function createAgileSupabaseClient(config: SupabaseConfig): SupabaseClient<Database> {
    return createClient<Database>(config.url, config.anonKey, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false,
            storage: config.storage,
        },
        global: {
            headers: {
                "x-application-name": "agile-mobile",
            },
        },
    });
}

export type { Database } from "./database.types.js";
export type AgileSupabase = SupabaseClient<Database>;
