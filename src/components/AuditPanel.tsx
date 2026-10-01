"use client";

import type { AuditResult } from "@/lib/audit";
import { dt } from "@/lib/time";
import type { Line, Rules, Violation } from "@/lib/types";
import { LINES } from "@/lib/types";
import { btn, CATEGORY_STYLE, cn, Panel, ScoreRing, SeverityBadge } from "./ui";

const LINE_LABEL: Record<Line, string> = { clinical: "Clinical", performance: "Performance", company: "Company" };

export function AuditPanel({
  audit,
  rules,
  focused,
  onFocus,
  onFix,
}: {
  audit: AuditResult;
  rules: Rules;
  focused: Violation | null;
  onFocus: (v: Violation | null) => void;
  onFix: (v: Violation) => void;
}) {
  const t = audit.totals;
  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex items-center justify-between gap-4">
          <ScoreRing score={audit.score} grade={audit.grade} />
          <div className="grid grid-cols-2 gap-x-5 gap-y-1 text-right text-xs text-slate-500">
            <span>
              <b className="text-sm tabular-nums text-slate-900">{t.meetings}</b> meetings
            </span>
            <span>
              <b className="text-sm tabular-nums text-slate-900">{t.meetingHours}h</b> in meetings
            </span>
            <span>
              <b className="text-sm tabular-nums text-slate-900">{t.externalMeetings}</b> external
            </span>
            <span>
              <b className="text-sm tabular-nums text-emerald-700">{t.focusHours}h</b> deep work
            </span>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Meeting time by business line</div>
          {LINES.map((l) => (
            <div key={l} className="text-xs">
              <div className="mb-1 flex justify-between">
                <span className={cn("font-medium", CATEGORY_STYLE[l].text)}>{LINE_LABEL[l]}</span>
                <span className="tabular-nums text-slate-500">
                  {t.allocation[l]}% <span className="text-slate-400">· target {rules.allocation[l]}%</span>
                </span>
              </div>
              <div className="relative h-2 rounded-full bg-slate-100">
                <div className={cn("h-2 rounded-full", CATEGORY_STYLE[l].dot)} style={{ width: `${Math.min(100, t.allocation[l])}%` }} />
                <div className="absolute -top-0.5 h-3 w-0.5 rounded bg-slate-500" style={{ left: `${rules.allocation[l]}%` }} title="Target" />
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel className="p-0">
        <div className="border-b border-slate-100 px-4 py-3 text-[13px] font-semibold text-slate-900">
          {audit.violations.length ? `${audit.violations.length} things to fix` : "Nothing to fix. This week is healthy."}
        </div>
        <ul className="max-h-[560px] divide-y divide-slate-100 overflow-y-auto">
          {audit.violations.map((v, i) => {
            const active = focused === v || (focused?.message === v.message && focused?.day === v.day);
            return (
              <li key={`${v.rule}-${v.day}-${i}`} className={cn("px-4 py-3 transition-colors", active ? "bg-slate-50" : "hover:bg-slate-50/60")}>
                <button type="button" className="w-full text-left" onClick={() => onFocus(active ? null : v)}>
                  <div className="flex items-center gap-2">
                    <SeverityBadge severity={v.severity} />
                    <span className="text-xs font-medium text-slate-500">
                      {v.rule} · {dt(`${v.day}T12:00:00`).toFormat("ccc")}
                    </span>
                  </div>
                  <p className="mt-1 text-[13px] leading-snug text-slate-800">{v.message}</p>
                  <p className="mt-1 text-xs leading-snug text-slate-500">→ {v.suggestion}</p>
                </button>
                {v.fixEventId && (
                  <button type="button" className={cn(btn.small, "mt-2")} onClick={() => onFix(v)}>
                    ✨ Apply fix
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
}
