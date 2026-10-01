import { findSlots } from "./slots";
import { dt, fmtDay, fmtTime, minutes } from "./time";
import type { CalEvent, Line, Rules } from "./types";
import { LINES } from "./types";

export interface MoveResult {
  events: CalEvent[];
  message: string;
  moved: boolean;
}

/**
 * Move one event to the best slot on another day this week, using the same
 * scheduler (and therefore the same rules) as new meeting requests.
 */
export function moveEvent(events: CalEvent[], id: string, rules: Rules, mondayIso: string): MoveResult {
  const event = events.find((e) => e.id === id);
  if (!event) return { events, message: "That meeting no longer exists.", moved: false };
  const others = events.filter((e) => e.id !== id);
  const monday = dt(`${mondayIso}T00:00:00`, rules.timezone);
  const originalDay = dt(event.start).toISODate();
  const category: Line = (LINES as readonly string[]).includes(event.category) ? (event.category as Line) : "company";

  const slots = findSlots(
    {
      title: event.title,
      durationMinutes: minutes(event.start, event.end),
      attendees: event.attendees,
      category,
      external: event.attendees.some((a) => a.external),
      from: monday.toISODate()!,
      to: monday.plus({ days: 4 }).toISODate()!,
      preference: "any",
    },
    others,
    rules,
    20,
  ).filter((s) => s.start.slice(0, 10) !== originalDay);

  const best = slots[0];
  if (!best) return { events, message: `No better slot found for “${event.title}” this week.`, moved: false };
  const moved = { ...event, start: best.start, end: best.end };
  return {
    events: [...others, moved].sort((a, b) => a.start.localeCompare(b.start)),
    message: `Moved “${event.title}” to ${fmtDay(dt(best.start))}, ${fmtTime(dt(best.start))} (${best.reasons.slice(0, 2).join(", ") || "best open slot"}).`,
    moved: true,
  };
}
