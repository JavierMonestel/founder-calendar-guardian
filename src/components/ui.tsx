import type { ReactNode } from "react";
import type { Category, Severity } from "@/lib/types";

export function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export const CATEGORY_STYLE: Record<Category, { block: string; dot: string; text: string }> = {
  clinical: { block: "bg-teal-50 border-teal-300 text-teal-900", dot: "bg-teal-500", text: "text-teal-700" },
  performance: { block: "bg-orange-50 border-orange-300 text-orange-900", dot: "bg-orange-500", text: "text-orange-700" },
  company: { block: "bg-indigo-50 border-indigo-300 text-indigo-900", dot: "bg-indigo-500", text: "text-indigo-700" },
  focus: { block: "focus-stripes border-emerald-300 text-emerald-900", dot: "bg-emerald-500", text: "text-emerald-700" },
  personal: { block: "bg-slate-100 border-slate-300 text-slate-700", dot: "bg-slate-400", text: "text-slate-600" },
  travel: { block: "bg-sky-50 border-sky-300 text-sky-900", dot: "bg-sky-500", text: "text-sky-700" },
};

export const SEVERITY_STYLE: Record<Severity, string> = {
  high: "bg-rose-50 text-rose-700 ring-rose-600/20",
  medium: "bg-amber-50 text-amber-700 ring-amber-600/20",
  low: "bg-slate-100 text-slate-600 ring-slate-500/20",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return <span className={cn("rounded px-1.5 py-0.5 text-[10.5px] font-semibold uppercase ring-1 ring-inset", SEVERITY_STYLE[severity])}>{severity}</span>;
}

export function ScoreRing({ score, grade }: { score: number; grade: string }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const color = score >= 80 ? "#10b981" : score >= 50 ? "#f59e0b" : "#f43f5e";
  return (
    <div className="flex items-center gap-3">
      <svg viewBox="0 0 72 72" className="h-16 w-16 -rotate-90" aria-hidden>
        <circle cx="36" cy="36" r={r} fill="none" stroke="#e2e8f0" strokeWidth="7" />
        <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} style={{ transition: "stroke-dashoffset .5s" }} />
      </svg>
      <div>
        <div className="text-2xl font-semibold tabular-nums leading-none text-slate-900">
          {score}
          <span className="text-sm font-normal text-slate-400">/100</span>
        </div>
        <div className="mt-1 text-xs font-medium" style={{ color }}>
          {grade}
        </div>
      </div>
    </div>
  );
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-xl border border-slate-200 bg-white p-4 shadow-sm", className)}>{children}</div>;
}

export const btn = {
  primary: "inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-700 disabled:opacity-50",
  secondary: "inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50",
  small: "inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50",
  ghost: "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900",
};

export const input = "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100";

export function Spinner() {
  return <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />;
}
