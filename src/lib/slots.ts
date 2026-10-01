import type { DateTime } from "luxon";
import { dayEvents, focusBlocks, isExternal, isMeeting } from "./audit";
import { at, dt, fmtTime, minutes, overlaps } from "./time";
import type { CalEvent, Rules, SchedulingRequest, SlotCandidate } from "./types";

const STEP = 15; // minutes
const ATTENDEE_DAY = { start: 9, end: 17.5 }; // local hours we're comfortable proposing to others

/**
 * Rank meeting slots for a request against the founder's calendar and rules.
 * Hard constraints exclude a slot; soft preferences adjust its score, and every
 * adjustment is recorded as a human-readable reason.
 */
export function findSlots(req: SchedulingRequest, events: CalEvent[], rules: Rules, limit = 5): SlotCandidate[] {
  const out: SlotCandidate[] = [];
  let day = dt(`${req.from}T00:00:00`, rules.timezone);
  const last = dt(`${req.to}T23:59:00`, rules.timezone);
  let dayIndex = 0;

  while (day <= last) {
    if (day.weekday <= 5) {
      out.push(...slotsForDay(req, events, rules, day, dayIndex));
      dayIndex++;
    }
    day = day.plus({ days: 1 });
  }

  // Best first; at most two per day, at least an hour apart, so the options are real alternatives.
  const picked: SlotCandidate[] = [];
  for (const s of out.sort((a, b) => b.score - a.score || a.start.localeCompare(b.start))) {
    const sameDay = picked.filter((p) => p.start.slice(0, 10) === s.start.slice(0, 10));
    if (sameDay.length >= 2) continue;
    if (sameDay.some((p) => Math.abs(dt(p.start).diff(dt(s.start), "minutes").minutes) < 60)) continue;
    picked.push(s);
    if (picked.length === limit) break;
  }
  return picked;
}

function slotsForDay(req: SchedulingRequest, events: CalEvent[], rules: Rules, day: DateTime, dayIndex: number): SlotCandidate[] {
  const todays = dayEvents(events, day);
  const meetingsToday = todays.filter(isMeeting);
  if (meetingsToday.length >= rules.maxMeetingsPerDay) return [];

  const focusBefore = focusBlocks(events, day, rules).length;
  const startOfDay = at(day, rules.workdayStart);
  const endOfDay = at(day, rules.workdayEnd);
  const results: SlotCandidate[] = [];

  for (let t = startOfDay; t.plus({ minutes: req.durationMinutes }) <= endOfDay; t = t.plus({ minutes: STEP })) {
    const start = t.toISO()!;
    const end = t.plus({ minutes: req.durationMinutes }).toISO()!;
    const reasons: string[] = [];
    let score = 100;

    // Hard: no overlap with anything, including focus blocks and personal time.
    if (todays.some((e) => overlaps(start, end, e.start, e.end))) continue;

    // Hard: internal attendees are busy when they're in another meeting on this calendar.
    const internalNames = req.attendees.filter((a) => !a.external).map((a) => a.name);
    if (todays.some((e) => e.attendees.some((a) => internalNames.includes(a.name)) && overlaps(start, end, e.start, e.end))) continue;

    // Hard: keep the buffer after external calls, and after this one if it's external.
    const prev = [...todays].reverse().find((e) => dt(e.end) <= t);
    const next = todays.find((e) => dt(e.start) >= dt(end));
    if (prev && isExternal(prev) && minutes(prev.end, start) < rules.bufferAfterExternalMinutes) continue;
    if (req.external && next && isMeeting(next) && minutes(end, next.start) < rules.bufferAfterExternalMinutes) continue;

    // Hard: protected Friday afternoon.
    if (rules.noExternalFridayAfternoon && req.external && day.weekday === 5 && t.hour >= 12) continue;

    // Hard: every attendee must be inside their own working day.
    const local = req.attendees
      .filter((a) => a.timezone && a.timezone !== rules.timezone)
      .map((a) => {
        const ls = dt(start).setZone(a.timezone!);
        const le = dt(end).setZone(a.timezone!);
        return { a, ls, le };
      });
    const outside = local.filter(({ ls, le }) => ls.hour + ls.minute / 60 < ATTENDEE_DAY.start || le.hour + le.minute / 60 > ATTENDEE_DAY.end);
    if (outside.length) continue;

    // Soft: don't destroy the day's deep-work window.
    const focusAfter = focusBlocks([...events, { id: "_slot", title: req.title, start, end, category: req.category, attendees: req.attendees }], day, rules).length;
    if (focusAfter < focusBefore && focusAfter < rules.focusBlocksPerDay) {
      score -= 40;
      reasons.push("cuts into the day's only focus block");
    } else if (focusBefore >= rules.focusBlocksPerDay) {
      reasons.push("keeps a focus block intact");
    }

    // Soft: preference and urgency.
    const isMorning = t.hour < 12;
    if (req.preference !== "any") {
      if ((req.preference === "morning") === isMorning) {
        score += 15;
        reasons.push(`${req.preference} as requested`);
      } else score -= 10;
    }
    score += Math.max(0, 5 - dayIndex) * 3;
    if (dayIndex === 0) reasons.push("earliest available day");

    // Soft: batch meetings by business line, avoid piling onto heavy days.
    const sameLine = meetingsToday.filter((e) => e.category === req.category).length;
    if (sameLine > 0) {
      score += 8;
      reasons.push(`batched with ${sameLine} other ${req.category} meeting${sameLine > 1 ? "s" : ""}`);
    }
    score -= meetingsToday.length * 4;
    if (meetingsToday.length <= 2) reasons.push("light meeting day");

    // Soft: back-to-back chains and edges of other people's days.
    const touching = [prev, next].filter((e) => e && isMeeting(e) && (minutes(e.end, start) === 0 || minutes(end, e.start) === 0));
    if (touching.length) {
      score -= 6 * touching.length;
      reasons.push("back-to-back with another meeting");
    }
    for (const { a, ls } of local) {
      const h = ls.hour + ls.minute / 60;
      if (h < 9.5 || h >= 16.5) score -= 5;
      else reasons.push(`comfortable time for ${shortName(a.name)} (${ls.toFormat("h:mm a ZZZZ")})`);
    }

    results.push({
      start,
      end,
      score,
      reasons,
      local: req.attendees
        .filter((a) => a.timezone && a.timezone !== rules.timezone)
        .map((a) => ({ name: a.name, timezone: a.timezone!, label: label(start, end, a.timezone!) })),
    });
  }
  return results;
}

/** "Dr. Alan Brooks" -> "Dr. Brooks", "Elena Ruiz" -> "Elena". */
export function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[0] === "Dr." ? `Dr. ${parts.at(-1)}` : parts[0];
}

export function label(startIso: string, endIso: string, zone: string): string {
  const s = dt(startIso).setZone(zone);
  const e = dt(endIso).setZone(zone);
  return `${s.toFormat("ccc, LLL d")} · ${fmtTime(s)}–${fmtTime(e)} ${e.toFormat("ZZZZ")}`;
}
