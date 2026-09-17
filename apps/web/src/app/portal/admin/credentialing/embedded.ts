/**
 * Reads a to-one embedded relation from a PostgREST result.
 *
 * `select("location:location_id (name)")` on a to-one foreign key returns a
 * single object at runtime, but the generated types describe it as an array.
 * Normalizing both shapes here keeps the call sites honest — a blind cast
 * would compile and then read `.name` off an array at runtime.
 */
export function embedded(value: unknown): Record<string, unknown> | null {
  if (value == null) return null;
  if (Array.isArray(value)) return (value[0] as Record<string, unknown> | undefined) ?? null;
  return value as Record<string, unknown>;
}
