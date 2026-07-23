import "server-only";

// Sliding-window rate limiter for auth-sensitive actions. In-memory: correct
// for a single server instance; when the portal scales to multiple instances,
// move the window store to Postgres or Redis.

const windows = new Map<string, number[]>();

export function rateLimit(key: string, maxAttempts: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = (windows.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= maxAttempts) {
    windows.set(key, hits);
    return false;
  }
  hits.push(now);
  windows.set(key, hits);
  // Opportunistic cleanup so the map doesn't grow unbounded.
  if (windows.size > 10_000) {
    for (const [k, v] of windows) {
      if (v.every((t) => now - t >= windowMs)) windows.delete(k);
    }
  }
  return true;
}
