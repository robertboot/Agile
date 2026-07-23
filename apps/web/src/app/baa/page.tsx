import Image from "next/image";
import { BAA_TEXT } from "@/lib/baa";
import { PrintButton } from "./PrintButton";

export const metadata = { title: "Business Associate Agreement" };

/** Print-friendly BAA for wet signatures — reps download/print from here. */
export default function BaaPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl px-8 py-10">
        <div className="mb-6 flex items-center justify-between print:hidden">
          <Image src="/logo.png" alt="Agile Medical Group" width={124} height={44} />
          <PrintButton />
        </div>

        <h1 className="text-2xl font-bold text-navy-900">Business Associate Agreement</h1>
        <p className="mt-1 text-sm text-slate-500">Agile Medical Group, LLC</p>

        <div className="mt-6 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
          {BAA_TEXT}
        </div>

        <div className="mt-10 grid grid-cols-2 gap-10 text-sm">
          <div>
            <div className="mb-10 font-semibold text-navy-900">Covered Entity (Provider)</div>
            <div className="border-t border-slate-400 pt-1">Signature</div>
            <div className="mt-8 border-t border-slate-400 pt-1">Printed name &amp; title</div>
            <div className="mt-8 border-t border-slate-400 pt-1">Practice name</div>
            <div className="mt-8 border-t border-slate-400 pt-1">Date</div>
          </div>
          <div>
            <div className="mb-10 font-semibold text-navy-900">Business Associate</div>
            <div className="border-t border-slate-400 pt-1">Signature</div>
            <div className="mt-8 border-t border-slate-400 pt-1">Printed name &amp; title</div>
            <div className="mt-8 border-t border-slate-400 pt-1">Agile Medical Group, LLC</div>
            <div className="mt-8 border-t border-slate-400 pt-1">Date</div>
          </div>
        </div>
      </div>
    </div>
  );
}
