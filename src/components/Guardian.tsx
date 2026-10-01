"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { auditWeek } from "@/lib/audit";
import { DEFAULT_RULES } from "@/lib/demo";
import { moveEvent } from "@/lib/fix";
import { dt, fmtDay, fmtTime } from "@/lib/time";
import type { CalEvent, Rules, SlotCandidate, Violation } from "@/lib/types";
import { AuditPanel } from "./AuditPanel";
import { ImportPanel } from "./ImportPanel";
import { RulesPanel } from "./RulesPanel";
import { SchedulePanel, type ScheduleResult } from "./SchedulePanel";
import { cn, Spinner } from "./ui";
import { WeekCalendar } from "./WeekCalendar";

const TABS = ["Audit", "Schedule", "Rules", "Import"] as const;
type Tab = (typeof TABS)[number];
const STORAGE_KEY = "calendar-guardian:v1";

interface Saved {
  monday: string;
  events: CalEvent[];
  rules: Rules;
}

interface Demo {
  monday: string;
  events: CalEvent[];
}

function loadSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

const noop = () => () => {};

export function GuardianGate({ demo, aiOn }: { demo: Demo; aiOn: boolean }) {
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  if (!hydrated) {
    return (
      <div className="flex h-96 items-center justify-center text-slate-400">
        <Spinner />
      </div>
    );
  }
  return <Guardian demo={demo} aiOn={aiOn} saved={loadSaved()} />;
}

function Guardian({ demo, aiOn, saved }: { demo: Demo; aiOn: boolean; saved: Saved | null }) {
  // A saved week from an older demo run is stale; start over on the current week.
  const fresh = saved && saved.monday >= demo.monday ? saved : null;
  const [monday, setMonday] = useState(fresh?.monday ?? demo.monday);
  const [events, setEvents] = useState<CalEvent[]>(fresh?.events ?? demo.events);
  const [rules, setRules] = useState<Rules>(fresh?.rules ?? DEFAULT_RULES);
  const [tab, setTab] = useState<Tab>("Audit");
  const [focused, setFocused] = useState<Violation | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<ScheduleResult | null>(null);
  const [scheduling, setScheduling] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [hover, setHover] = useState<SlotCandidate | null>(null);
  const [startScore] = useState(() => auditWeek(fresh?.events ?? demo.events, fresh?.rules ?? DEFAULT_RULES, fresh?.monday ?? demo.monday).score);

  const audit = useMemo(() => auditWeek(events, rules, monday), [events, rules, monday]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ monday, events, rules } satisfies Saved));
    } catch {}
  }, [monday, events, rules]);

  const flash = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((t) => (t === message ? null : t)), 6000);
  };

  const applyFix = (v: Violation) => {
    if (!v.fixEventId) return;
    const result = moveEvent(events, v.fixEventId, rules, monday);
    if (result.moved) {
      setEvents(result.events);
      setFocused(null);
    }
    flash(result.message);
  };

  const find = async (text: string) => {
    setScheduling(true);
    setScheduleError(null);
    try {
      const interpreted = await fetch("/api/interpret", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      const parsed = await interpreted.json();
      if (!interpreted.ok) throw new Error(parsed.error ?? "Could not understand that request.");
      const res = await fetch("/api/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request: parsed.request, events, rules }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not search for slots.");
      setSchedule({ engine: parsed.engine, request: parsed.request, slots: data.slots, email: data.email });
    } catch (e) {
      setScheduleError(e instanceof Error ? e.message : String(e));
    } finally {
      setScheduling(false);
    }
  };

  const book = (slot: SlotCandidate) => {
    if (!schedule) return;
    const r = schedule.request;
    const event: CalEvent = {
      id: `b${Date.now()}`,
      title: r.title,
      start: slot.start,
      end: slot.end,
      category: r.category,
      attendees: r.attendees,
      agenda: r.external ? undefined : "Booked via Calendar Guardian",
      movable: !r.external,
    };
    setEvents((evs) => [...evs, event].sort((a, b) => a.start.localeCompare(b.start)));
    setSchedule(null);
    setHover(null);
    setTab("Audit");
    flash(`Booked “${r.title}” on ${fmtDay(dt(slot.start))}, ${fmtTime(dt(slot.start))}. The week was re-audited.`);
  };

  const reset = () => {
    setMonday(demo.monday);
    setEvents(demo.events);
    setRules(DEFAULT_RULES);
    setSchedule(null);
    setFocused(null);
    flash("Demo week restored.");
  };

  const ghosts = hover ? [hover] : schedule && tab === "Schedule" ? schedule.slots.slice(0, 3) : [];
  const weekLabel = `${dt(`${monday}T12:00:00`).toFormat("LLL d")} – ${dt(`${monday}T12:00:00`).plus({ days: 4 }).toFormat("LLL d, yyyy")}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Founder week · {weekLabel}</h1>
          <p className="text-sm text-slate-500">
            Times in ET · <span className="font-medium text-rose-600">red ring</span> = rule broken · <span className="font-medium text-amber-600">amber</span> = worth a look ·
            red dot = external guest
          </p>
        </div>
        {audit.score !== startScore && (
          <div className="rounded-lg bg-emerald-50 px-3 py-1.5 text-sm text-emerald-800 ring-1 ring-inset ring-emerald-200">
            Calendar health {startScore} → <b>{audit.score}</b>
          </div>
        )}
      </div>

      {toast && <div className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm">✨ {toast}</div>}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <WeekCalendar
          monday={monday}
          events={events}
          rules={rules}
          violations={audit.violations}
          focusedEventIds={focused?.eventIds ?? []}
          ghosts={ghosts}
          onSelectEvent={(id) => setFocused(audit.violations.find((v) => v.eventIds.includes(id)) ?? null)}
        />
        <aside className="space-y-3">
          <div className="flex gap-1 rounded-lg bg-slate-100 p-1" role="tablist">
            {TABS.map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={cn("flex-1 rounded-md px-2 py-1.5 text-sm font-medium transition-colors", tab === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800")}
              >
                {t}
              </button>
            ))}
          </div>
          {tab === "Audit" && <AuditPanel audit={audit} rules={rules} focused={focused} onFocus={setFocused} onFix={applyFix} />}
          {tab === "Schedule" && (
            <SchedulePanel rules={rules} aiOn={aiOn} result={schedule} loading={scheduling} error={scheduleError} onFind={find} onBook={book} onHover={setHover} />
          )}
          {tab === "Rules" && <RulesPanel rules={rules} onChange={setRules} />}
          {tab === "Import" && (
            <ImportPanel
              onImported={(m, evs, skipped) => {
                setMonday(m);
                setEvents(evs);
                setFocused(null);
                setSchedule(null);
                setTab("Audit");
                flash(
                  `Imported ${evs.length} event${evs.length === 1 ? "" : "s"} for the week of ${fmtDay(dt(`${m}T12:00:00`))}.` +
                    (skipped ? ` ${skipped} from other weeks were left out.` : ""),
                );
              }}
              onReset={reset}
            />
          )}
        </aside>
      </div>
    </div>
  );
}
