import { DateTime, Interval } from "luxon";

export const FOUNDER_TZ = "America/New_York";

export function dt(iso: string, zone = FOUNDER_TZ): DateTime {
  return DateTime.fromISO(iso, { zone, setZone: false }).setZone(zone);
}

export function minutes(a: string, b: string): number {
  return Math.round(dt(b).diff(dt(a), "minutes").minutes);
}

export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return dt(aStart) < dt(bEnd) && dt(bStart) < dt(aEnd);
}

/** Monday of the week after `today` (or of this week if today is a weekend). */
export function nextWeekMonday(today: DateTime): DateTime {
  const base = today.startOf("day");
  const daysToMonday = (8 - base.weekday) % 7 || 7; // luxon: Monday = 1 … Sunday = 7
  return base.plus({ days: daysToMonday });
}

export function at(day: DateTime, hhmm: string): DateTime {
  const [h, m] = hhmm.split(":").map(Number);
  return day.set({ hour: h, minute: m, second: 0, millisecond: 0 });
}

export function weekdays(monday: DateTime): DateTime[] {
  return Array.from({ length: 5 }, (_, i) => monday.plus({ days: i }));
}

export function fmtTime(d: DateTime): string {
  return d.toFormat(d.minute === 0 ? "h a" : "h:mm a");
}

export function fmtDay(d: DateTime): string {
  return d.toFormat("ccc, LLL d");
}

export function freeGaps(dayStart: DateTime, dayEnd: DateTime, busy: { start: string; end: string }[]): Interval[] {
  const sorted = [...busy]
    .map((b) => Interval.fromDateTimes(dt(b.start), dt(b.end)))
    .filter((i) => i.isValid && i.overlaps(Interval.fromDateTimes(dayStart, dayEnd)))
    .sort((a, b) => a.start!.toMillis() - b.start!.toMillis());
  const gaps: Interval[] = [];
  let cursor = dayStart;
  for (const b of sorted) {
    if (b.start! > cursor) gaps.push(Interval.fromDateTimes(cursor, b.start!));
    if (b.end! > cursor) cursor = b.end!;
  }
  if (cursor < dayEnd) gaps.push(Interval.fromDateTimes(cursor, dayEnd));
  return gaps.filter((g) => g.length("minutes") > 0);
}
