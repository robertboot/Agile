"use client";

import { useEffect } from "react";

export function PrintControls() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="no-print mb-6 flex gap-3">
      <button
        type="button"
        onClick={() => window.print()}
        className="btn-brand rounded-lg px-4 py-2 text-sm font-semibold text-white"
      >
        🖨 Print / Save as PDF
      </button>
      <button
        type="button"
        onClick={() => window.close()}
        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600"
      >
        Close
      </button>
    </div>
  );
}
