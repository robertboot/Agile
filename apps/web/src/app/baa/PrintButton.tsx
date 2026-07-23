"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="btn-brand rounded-lg px-4 py-2 text-sm font-semibold text-white"
    >
      🖨 Print / Save as PDF
    </button>
  );
}
