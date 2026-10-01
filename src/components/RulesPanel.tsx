"use client";

import type { Rules } from "@/lib/types";
import { LINES } from "@/lib/types";
import { input, Panel } from "./ui";

type NumKey = "maxMeetingsPerDay" | "minFocusMinutes" | "focusBlocksPerDay" | "bufferAfterExternalMinutes" | "maxBackToBack";

const NUMBERS: [NumKey, string, string][] = [
  ["maxMeetingsPerDay", "Max meetings per day", ""],
  ["minFocusMinutes", "Focus block length", "min"],
  ["focusBlocksPerDay", "Focus blocks per day", ""],
  ["bufferAfterExternalMinutes", "Buffer after external calls", "min"],
  ["maxBackToBack", "Max meetings back-to-back", ""],
];

export function RulesPanel({ rules, onChange }: { rules: Rules; onChange: (r: Rules) => void }) {
  const set = <K extends keyof Rules>(k: K, v: Rules[K]) => onChange({ ...rules, [k]: v });
  const total = LINES.reduce((s, l) => s + rules.allocation[l], 0);
  return (
    <div className="space-y-4">
      <Panel>
        <div className="text-[13px] font-semibold text-slate-900">Founder operating rules</div>
        <p className="mt-1 text-xs text-slate-500">These are the agreements the EA protects. Every change re-audits the week instantly.</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="text-xs font-medium text-slate-600">
            Workday starts
            <input type="time" value={rules.workdayStart} onChange={(e) => set("workdayStart", e.target.value)} className={`${input} mt-1`} />
          </label>
          <label className="text-xs font-medium text-slate-600">
            Workday ends
            <input type="time" value={rules.workdayEnd} onChange={(e) => set("workdayEnd", e.target.value)} className={`${input} mt-1`} />
          </label>
          {NUMBERS.map(([k, labelText, unit]) => (
            <label key={k} className="text-xs font-medium text-slate-600">
              {labelText} {unit && <span className="text-slate-400">({unit})</span>}
              <input type="number" min={0} value={rules[k]} onChange={(e) => set(k, Math.max(0, Number(e.target.value) || 0))} className={`${input} mt-1`} />
            </label>
          ))}
          <label className="col-span-2 flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={rules.noExternalFridayAfternoon} onChange={(e) => set("noExternalFridayAfternoon", e.target.checked)} className="h-4 w-4 accent-slate-900" />
            Protect Friday afternoons from external calls
          </label>
        </div>
      </Panel>
      <Panel>
        <div className="flex items-center justify-between">
          <div className="text-[13px] font-semibold text-slate-900">Target time allocation</div>
          <span className={total === 100 ? "text-xs text-emerald-700" : "text-xs text-rose-600"}>{total}%</span>
        </div>
        <div className="mt-3 space-y-3">
          {LINES.map((l) => (
            <label key={l} className="block text-xs font-medium capitalize text-slate-600">
              {l}: {rules.allocation[l]}%
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={rules.allocation[l]}
                onChange={(e) => set("allocation", { ...rules.allocation, [l]: Number(e.target.value) })}
                className="mt-1 w-full accent-slate-900"
              />
            </label>
          ))}
        </div>
      </Panel>
    </div>
  );
}
