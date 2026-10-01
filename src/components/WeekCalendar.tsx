"use client";

import { DateTime } from "luxon";
import { dt, fmtTime } from "@/lib/time";
import type { CalEvent, Rules, Severity, SlotCandidate, Violation } from "@/lib/types";
import { CATEGORY_STYLE, cn } from "./ui";

const START_HOUR = 8;
const END_HOUR = 20;
const PX_PER_MIN = 1.05;

export function WeekCalendar({
  monday,
  events,
  rules,
  violations,
  focusedEventIds,
  ghosts,
  onSelectEvent,
}: {
  monday: string;
  events: CalEvent[];
  rules: Rules;
  violations: Violation[];
  focusedEventIds: string[];
  ghosts: SlotCandidate[];
  onSelectEvent?: (id: string) => void;
}) {
  const days = Array.from({ length: 5 }, (_, i) => DateTime.fromISO(monday, { zone: rules.timezone }).plus({ days: i }));
  const height = (END_HOUR - START_HOUR) * 60 * PX_PER_MIN;
  const top = (iso: string) => {
    const d = dt(iso, rules.timezone);
    return Math.max(0, (d.hour * 60 + d.minute - START_HOUR * 60) * PX_PER_MIN);
  };
  const severityOf = new Map<string, Severity>();
  for (const v of violations) {
    for (const id of v.eventIds) {
      const cur = severityOf.get(id);
      if (!cur || (cur !== "high" && v.severity === "high") || (cur === "low" && v.severity === "medium")) severityOf.set(id, v.severity);
    }
  }
  const [wsH, wsM] = rules.workdayStart.split(":").map(Number);
  const [weH, weM] = rules.workdayEnd.split(":").map(Number);
  const workTop = (wsH * 60 + wsM - START_HOUR * 60) * PX_PER_MIN;
  const workBottom = (weH * 60 + weM - START_HOUR * 60) * PX_PER_MIN;

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="grid min-w-[720px]" style={{ gridTemplateColumns: "52px repeat(5, minmax(0, 1fr))" }}>
        <div className="border-b border-slate-100" />
        {days.map((d) => (
          <div key={d.toISODate()} className="border-b border-l border-slate-100 px-2 py-2 text-center">
            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{d.toFormat("ccc")}</div>
            <div className="text-sm font-semibold text-slate-800">{d.toFormat("LLL d")}</div>
          </div>
        ))}

        <div className="relative" style={{ height }}>
          {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
            <div key={i} className="absolute right-1.5 -translate-y-1.5 text-[10px] text-slate-400" style={{ top: i * 60 * PX_PER_MIN }}>
              {i === 0 ? "" : DateTime.fromObject({ hour: START_HOUR + i }).toFormat("h a")}
            </div>
          ))}
        </div>

        {days.map((d) => {
          const iso = d.toISODate();
          const todays = events.filter((e) => dt(e.start, rules.timezone).toISODate() === iso);
          const dayGhosts = ghosts.filter((g) => dt(g.start, rules.timezone).toISODate() === iso);
          return (
            <div key={iso} className="relative border-l border-slate-100" style={{ height }}>
              {/* outside working hours */}
              <div className="absolute inset-x-0 top-0 bg-slate-50" style={{ height: workTop }} />
              <div className="absolute inset-x-0 bg-slate-50" style={{ top: workBottom, bottom: 0 }} />
              {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
                <div key={i} className="absolute inset-x-0 border-t border-slate-100" style={{ top: i * 60 * PX_PER_MIN }} />
              ))}
              {todays.map((e) => {
                const t = top(e.start);
                const h = Math.max(16, top(e.end) - t - 2);
                const sev = severityOf.get(e.id);
                const focused = focusedEventIds.includes(e.id);
                const style = CATEGORY_STYLE[e.category];
                const external = e.attendees.some((a) => a.external);
                return (
                  <button
                    type="button"
                    key={e.id}
                    onClick={() => onSelectEvent?.(e.id)}
                    title={`${e.title}\n${fmtTime(dt(e.start))}–${fmtTime(dt(e.end))}${external ? "\nExternal" : ""}`}
                    className={cn(
                      "absolute inset-x-1 overflow-hidden rounded-md border px-1.5 py-0.5 text-left text-[11px] leading-tight transition-shadow",
                      style.block,
                      sev === "high" && "ring-2 ring-rose-400",
                      sev === "medium" && "ring-2 ring-amber-300",
                      focused && "z-10 ring-[3px] ring-slate-900 shadow-lg",
                    )}
                    style={{ top: t + 1, height: h }}
                  >
                    <span className="flex items-center gap-1 font-semibold">
                      {external && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" aria-label="external" />}
                      <span className="truncate">{e.title}</span>
                    </span>
                    {h > 30 && <span className="block truncate opacity-70">{fmtTime(dt(e.start))}–{fmtTime(dt(e.end))}</span>}
                  </button>
                );
              })}
              {dayGhosts.map((g) => (
                <div
                  key={g.start}
                  className="absolute inset-x-1 z-20 flex items-center justify-center rounded-md border-2 border-dashed border-violet-500 bg-violet-100/80 text-[11px] font-semibold text-violet-800"
                  style={{ top: top(g.start) + 1, height: Math.max(16, top(g.end) - top(g.start) - 2) }}
                >
                  Option {ghosts.indexOf(g) + 1}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
