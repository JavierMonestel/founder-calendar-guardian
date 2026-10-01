import type { DateTime } from "luxon";
import { at, dt, fmtDay, fmtTime, freeGaps, minutes, weekdays } from "./time";
import type { CalEvent, Line, Rules, Severity, Violation } from "./types";
import { LINES } from "./types";

export const isMeeting = (e: CalEvent) => (LINES as readonly string[]).includes(e.category);
export const isExternal = (e: CalEvent) => e.attendees.some((a) => a.external);

export interface DayStats {
  day: string;
  meetings: number;
  meetingMinutes: number;
  focusBlocks: { start: string; end: string; minutes: number }[];
  longestFree: number;
}

export interface AuditResult {
  score: number;
  grade: "Healthy" | "Needs attention" | "Overloaded";
  violations: Violation[];
  days: DayStats[];
  totals: {
    meetings: number;
    meetingHours: number;
    externalMeetings: number;
    focusHours: number;
    byLine: Record<Line, number>; // minutes
    allocation: Record<Line, number>; // actual %
  };
}

const WEIGHT: Record<Severity, number> = { high: 10, medium: 5, low: 2 };
/** Each rule costs at most two occurrences, so ten missing agendas can't sink the score alone. */
const MAX_COUNTED_PER_RULE = 2;

export function dayEvents(events: CalEvent[], day: DateTime): CalEvent[] {
  return events
    .filter((e) => dt(e.start).hasSame(day, "day"))
    .sort((a, b) => dt(a.start).toMillis() - dt(b.start).toMillis());
}

/** Deep-work windows: explicit focus events or free gaps long enough to count. */
export function focusBlocks(events: CalEvent[], day: DateTime, rules: Rules) {
  const start = at(day, rules.workdayStart);
  const end = at(day, rules.workdayEnd);
  const todays = dayEvents(events, day);
  const busy = todays.filter((e) => e.category !== "focus");
  const blocks = todays
    .filter((e) => e.category === "focus" && minutes(e.start, e.end) >= rules.minFocusMinutes)
    .map((e) => ({ start: e.start, end: e.end, minutes: minutes(e.start, e.end) }));
  for (const gap of freeGaps(start, end, busy)) {
    const len = Math.round(gap.length("minutes"));
    const insideFocus = blocks.some((b) => dt(b.start) <= gap.start! && dt(b.end) >= gap.end!);
    if (len >= rules.minFocusMinutes && !insideFocus) {
      blocks.push({ start: gap.start!.toISO()!, end: gap.end!.toISO()!, minutes: len });
    }
  }
  return blocks.sort((a, b) => dt(a.start).toMillis() - dt(b.start).toMillis());
}

export function auditWeek(events: CalEvent[], rules: Rules, mondayIso: string): AuditResult {
  const monday = dt(`${mondayIso}T00:00:00`, rules.timezone);
  const violations: Violation[] = [];
  const days: DayStats[] = [];
  const add = (v: Violation) => violations.push(v);

  for (const day of weekdays(monday)) {
    const iso = day.toISODate()!;
    const todays = dayEvents(events, day);
    const meetings = todays.filter(isMeeting);
    const start = at(day, rules.workdayStart);
    const end = at(day, rules.workdayEnd);
    const focus = focusBlocks(events, day, rules);
    const longestFree = Math.max(0, ...freeGaps(start, end, todays).map((g) => Math.round(g.length("minutes"))));
    days.push({ day: iso, meetings: meetings.length, meetingMinutes: meetings.reduce((s, e) => s + minutes(e.start, e.end), 0), focusBlocks: focus, longestFree });

    // 1. Meeting load
    if (meetings.length > rules.maxMeetingsPerDay) {
      const movable = meetings.filter((e) => e.movable && !isExternal(e));
      add({
        rule: "Max meetings per day",
        severity: "high",
        day: iso,
        message: `${meetings.length} meetings on ${fmtDay(day)} (limit ${rules.maxMeetingsPerDay}).`,
        eventIds: meetings.map((e) => e.id),
        suggestion: movable.length
          ? `Move or make async: ${movable.slice(0, meetings.length - rules.maxMeetingsPerDay).map((e) => `“${e.title}”`).join(", ")}.`
          : "Every meeting is external or fixed; protect tomorrow instead.",
        fixEventId: movable[0]?.id,
      });
    }

    // 2. Working hours
    for (const e of meetings) {
      if (dt(e.start) < start || dt(e.end) > end) {
        const ext = e.attendees.find((a) => a.external && a.timezone);
        add({
          rule: "Working hours",
          severity: "medium",
          day: iso,
          message: `“${e.title}” runs ${fmtTime(dt(e.start))}–${fmtTime(dt(e.end))}, outside ${rules.workdayStart}–${rules.workdayEnd}.`,
          eventIds: [e.id],
          suggestion: ext
            ? `Check for an overlap with ${ext.timezone?.split("/")[1]?.replace("_", " ")} hours, or ask for an async update / delegate.`
            : "Pull it inside working hours or make it async.",
        });
      }
    }

    // 3. Deep work
    if (focus.length < rules.focusBlocksPerDay) {
      const fix = suggestFocusFix(todays, day, rules);
      add({
        fixEventId: fix?.eventId,
        rule: "Daily focus block",
        severity: "high",
        day: iso,
        message: `No ${rules.minFocusMinutes}-minute block for deep work on ${fmtDay(day)} (longest gap: ${longestFree} min).`,
        eventIds: [],
        suggestion: fix?.text ?? "Block a focus session before the first meeting tomorrow.",
      });
    }

    // 4. Back-to-back chains
    let chain: CalEvent[] = [];
    const flush = () => {
      if (chain.length > rules.maxBackToBack) {
        add({
          rule: "Back-to-back meetings",
          severity: "medium",
          day: iso,
          message: `${chain.length} meetings in a row without a break, ${fmtTime(dt(chain[0].start))}–${fmtTime(dt(chain.at(-1)!.end))}.`,
          eventIds: chain.map((e) => e.id),
          suggestion: "Shorten one to 25 minutes (or 50) to create breathing room, or move an internal one.",
        });
      }
    };
    for (const e of meetings) {
      const prev = chain.at(-1);
      if (prev && minutes(prev.end, e.start) < 10) chain.push(e);
      else {
        flush();
        chain = [e];
      }
    }
    flush();

    // 5. Buffer after external calls
    for (let i = 0; i < meetings.length - 1; i++) {
      const a = meetings[i];
      const b = meetings[i + 1];
      if (isExternal(a) && minutes(a.end, b.start) < rules.bufferAfterExternalMinutes) {
        add({
          rule: "Buffer after external calls",
          severity: "low",
          day: iso,
          message: `No ${rules.bufferAfterExternalMinutes}-minute buffer between “${a.title}” and “${b.title}”.`,
          eventIds: [a.id, b.id],
          suggestion: b.movable ? `Start “${b.title}” ${rules.bufferAfterExternalMinutes} minutes later.` : "Keep notes short; Javier captures follow-ups.",
        });
      }
    }

    // 6. Protected Friday afternoon
    if (rules.noExternalFridayAfternoon && day.weekday === 5) {
      for (const e of meetings.filter((m) => isExternal(m) && dt(m.start).hour >= 12)) {
        add({
          rule: "No external calls Friday afternoon",
          severity: "medium",
          day: iso,
          message: `External call “${e.title}” on Friday afternoon.`,
          eventIds: [e.id],
          suggestion: e.movable ? "Offer another slot earlier in the week." : "Fixed by the other party; keep it short.",
          fixEventId: e.movable ? e.id : undefined,
        });
      }
    }

    // 7. External meetings need an agenda
    for (const e of meetings.filter((m) => isExternal(m) && !m.agenda)) {
      add({
        rule: "Agenda for external meetings",
        severity: "low",
        day: iso,
        message: `“${e.title}” has no agenda.`,
        eventIds: [e.id],
        suggestion: "Javier sends a 3-bullet agenda and the goal of the call 24 hours before.",
      });
    }
  }

  // 8. Time allocation across business lines
  const byLine = Object.fromEntries(LINES.map((l) => [l, 0])) as Record<Line, number>;
  const weekEvents = events.filter((e) => days.some((d) => dt(e.start).toISODate() === d.day));
  for (const e of weekEvents.filter(isMeeting)) byLine[e.category as Line] += minutes(e.start, e.end);
  const totalLine = Object.values(byLine).reduce((s, x) => s + x, 0) || 1;
  const allocation = Object.fromEntries(LINES.map((l) => [l, Math.round((byLine[l] / totalLine) * 100)])) as Record<Line, number>;
  // Allocation only means something once there are a couple of hours of meetings.
  for (const l of totalLine >= 120 ? LINES : []) {
    const diff = allocation[l] - rules.allocation[l];
    if (Math.abs(diff) >= 10) {
      add({
        rule: "Time allocation",
        severity: Math.abs(diff) >= 20 ? "medium" : "low",
        day: days[0].day,
        message: `${label(l)} got ${allocation[l]}% of meeting time vs. a ${rules.allocation[l]}% target.`,
        eventIds: [],
        suggestion: diff > 0 ? `Delegate or batch ${label(l).toLowerCase()} meetings next week.` : `Reserve time for ${label(l).toLowerCase()} next week.`,
      });
    }
  }

  const meetings = weekEvents.filter(isMeeting);
  const counted = new Map<string, number>();
  let penalty = 0;
  for (const v of [...violations].sort((x, y) => WEIGHT[y.severity] - WEIGHT[x.severity])) {
    const n = counted.get(v.rule) ?? 0;
    if (n < MAX_COUNTED_PER_RULE) penalty += WEIGHT[v.severity];
    counted.set(v.rule, n + 1);
  }
  const score = Math.max(0, 100 - penalty);
  return {
    score,
    grade: score >= 80 ? "Healthy" : score >= 50 ? "Needs attention" : "Overloaded",
    violations: violations.sort((a, b) => WEIGHT[b.severity] - WEIGHT[a.severity] || a.day.localeCompare(b.day)),
    days,
    totals: {
      meetings: meetings.length,
      meetingHours: Math.round((meetings.reduce((s, e) => s + minutes(e.start, e.end), 0) / 60) * 10) / 10,
      externalMeetings: meetings.filter(isExternal).length,
      focusHours: Math.round((days.reduce((s, d) => s + d.focusBlocks.reduce((x, b) => x + b.minutes, 0), 0) / 60) * 10) / 10,
      byLine,
      allocation,
    },
  };
}

/** Which single movable internal meeting, if moved, would free a focus block? */
function suggestFocusFix(todays: CalEvent[], day: DateTime, rules: Rules): { text: string; eventId: string } | null {
  const start = at(day, rules.workdayStart);
  const end = at(day, rules.workdayEnd);
  const candidates = todays.filter((e) => isMeeting(e) && e.movable && !isExternal(e));
  let best: { event: CalEvent; gap: number; from: DateTime; to: DateTime } | null = null;
  for (const e of candidates) {
    const without = todays.filter((x) => x.id !== e.id && x.category !== "focus");
    for (const g of freeGaps(start, end, without)) {
      const len = Math.round(g.length("minutes"));
      if (len >= rules.minFocusMinutes && (!best || len > best.gap)) best = { event: e, gap: len, from: g.start!, to: g.end! };
    }
  }
  return best
    ? {
        text: `Move “${best.event.title}” to another day to open a ${best.gap}-minute focus block (${fmtTime(best.from)}–${fmtTime(best.to)}).`,
        eventId: best.event.id,
      }
    : null;
}

function label(l: Line) {
  return { clinical: "Clinical", performance: "Performance", company: "Company" }[l];
}
