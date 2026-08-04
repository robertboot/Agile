"use client";

import { useEffect, useState } from "react";

// One-time "you can sort by clicking headers" hint. Dismissable; remembered
// in localStorage so it only ever shows on a first visit to the Orders page.
export function SortTip() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("orders-sort-tip")) setShow(true);
  }, []);

  if (!show) return null;

  const dismiss = () => {
    localStorage.setItem("orders-sort-tip", "1");
    setShow(false);
  };

  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
      <span>
        💡 <strong>Pro tip:</strong> click a column header — <strong>Patient</strong>,{" "}
        <strong>Date ordered</strong>, or <strong>Date applied</strong> — to sort. Click again to
        reverse.
      </span>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss tip"
        className="shrink-0 text-blue-400 hover:text-blue-700"
      >
        ✕
      </button>
    </div>
  );
}
