import { createAgileSupabaseClient, type AgileSupabase } from "@agile/supabase-client";
import * as SecureStore from "expo-secure-store";

const secureStorage = {
    getItem: (key: string) => SecureStore.getItemAsync(key),
    setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
    removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

let cached: AgileSupabase | null = null;

/**
 * Lazy Supabase client. Returns null if env vars are missing so the app can
 * still boot on a fresh dev device without a configured backend (useful for
 * AR-only testing on a LiDAR phone).
 */
export function getSupabase(): AgileSupabase | null {
    if (cached) return cached;
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) return null;
    cached = createAgileSupabaseClient({ url, anonKey, storage: secureStorage });
    return cached;
}

export function isSupabaseConfigured(): boolean {
    return Boolean(process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
}
