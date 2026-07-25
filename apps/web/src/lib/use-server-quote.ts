"use client";

import { useEffect, useRef, useState, useTransition } from "react";

/**
 * Debounced server-quote hook with a latest-wins guard (audit: quote-on-every-
 * keystroke had no debounce and no stale-response protection, so an earlier
 * slow response could overwrite a later one and show the wrong numbers).
 *
 * Re-runs when `deps` change; waits `delayMs` of quiet before calling; and
 * applies only the most recent in-flight result.
 */
export function useServerQuote<T>(
  fetcher: () => Promise<T | null>,
  deps: unknown[],
  delayMs = 300,
): { data: T | null; pending: boolean } {
  const [data, setData] = useState<T | null>(null);
  const [pending, start] = useTransition();
  const seq = useRef(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    const mySeq = ++seq.current;
    const timer = setTimeout(() => {
      start(async () => {
        try {
          const result = await fetcherRef.current();
          if (mySeq === seq.current) setData(result);
        } catch {
          if (mySeq === seq.current) setData(null);
        }
      });
    }, delayMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, pending };
}
