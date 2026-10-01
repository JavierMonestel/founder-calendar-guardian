import { DateTime } from "luxon";
import { label, shortName } from "./slots";
import { dt } from "./time";
import type { CalEvent, Category, SchedulingRequest, SlotCandidate } from "./types";

/** Email offering the top options in each external attendee's own time zone. */
export function draftEmail(req: SchedulingRequest, slots: SlotCandidate[], founderZone: string, founder = "Sam"): { to: string[]; subject: string; body: string } {
  const externals = req.attendees.filter((a) => a.external);
  const to = externals.length ? externals : req.attendees;
  const zone = externals.find((a) => a.timezone)?.timezone ?? founderZone;
  const first = to.map((a) => shortName(a.name)).join(" and ");
  const options = slots.slice(0, 3).map((s) => `  • ${label(s.start, s.end, zone)}`);
  return {
    to: to.map((a) => a.name),
    subject: `${req.title}: ${req.durationMinutes} minutes with ${founder}`,
    body: [
      `Hi ${first},`,
      "",
      `${founder} would love ${req.durationMinutes} minutes to talk about ${req.title.charAt(0).toLowerCase() + req.title.slice(1)}. Would any of these work for you?`,
      "",
      ...options,
      "",
      "Happy to send an invite as soon as you pick one, or to work around your calendar if none of these fit.",
      "",
      "Best,",
      `Javier Monestel · Executive Assistant to ${founder}`,
    ].join("\n"),
  };
}

const esc = (t: string) => t.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
const utc = (iso: string) => dt(iso).toUTC().toFormat("yyyyMMdd'T'HHmmss'Z'");

/** Tentative holds for the proposed slots, so nobody else books over them. */
export function holdsIcs(req: SchedulingRequest, slots: SlotCandidate[], now: DateTime = DateTime.utc()): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Founder Calendar Guardian//EN"];
  slots.slice(0, 3).forEach((s, i) => {
    lines.push(
      "BEGIN:VEVENT",
      `UID:hold-${i}-${utc(s.start)}@calendar-guardian`,
      `DTSTAMP:${now.toFormat("yyyyMMdd'T'HHmmss'Z'")}`,
      `DTSTART:${utc(s.start)}`,
      `DTEND:${utc(s.end)}`,
      `SUMMARY:${esc(`HOLD (option ${i + 1}/3): ${req.title}`)}`,
      `DESCRIPTION:${esc(`Proposed to ${req.attendees.map((a) => a.name).join(", ")}. Release the other holds once one is confirmed.`)}`,
      "STATUS:TENTATIVE",
      "TRANSP:OPAQUE",
      "END:VEVENT",
    );
  });
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

// ---------------------------------------------------------------- .ics import

const CLINICAL = /\b(hospital|health|clinic|clinical|cardio|fda|irb|patient|regulatory|pilot|study|research)\b/i;
const PERFORMANCE = /\b(athlete|club|coach|strap|member|growth|race|hydration|creator|podcast|marketing)\b/i;
const FOCUS = /\b(focus|deep work|heads? down|no meetings|writing time)\b/i;
const PERSONAL = /\b(lunch|gym|doctor|dentist|family|pickup|personal|dinner)\b/i;
const TRAVEL = /\b(flight|travel|airport|train|drive to)\b/i;

export function categorize(title: string): Category {
  if (FOCUS.test(title)) return "focus";
  if (TRAVEL.test(title)) return "travel";
  if (PERSONAL.test(title)) return "personal";
  if (CLINICAL.test(title)) return "clinical";
  if (PERFORMANCE.test(title)) return "performance";
  return "company";
}

/**
 * Minimal iCalendar parser for exported calendars (Google, Outlook, Apple):
 * unfolds lines, reads VEVENTs with UTC, TZID or floating times, and attendees.
 * Recurring rules are not expanded; exported single-week ranges don't need it.
 */
export function parseIcs(text: string, founderZone: string, ownEmails: string[] = []): CalEvent[] {
  const unfolded = text.replace(/\r?\n[ \t]/g, "");
  const events: CalEvent[] = [];
  let i = 0;
  for (const block of unfolded.split("BEGIN:VEVENT").slice(1)) {
    const body = block.split("END:VEVENT")[0];
    const field = (name: string) => body.split(/\r?\n/).find((l) => l.startsWith(name + ":") || l.startsWith(name + ";"));
    const value = (line?: string) => (line ? line.slice(line.indexOf(":") + 1).trim() : "");
    const when = (line?: string) => {
      if (!line) return null;
      const tz = line.match(/TZID=([^:;]+)/)?.[1];
      const raw = value(line);
      const fmt = raw.length === 8 ? "yyyyMMdd" : "yyyyMMdd'T'HHmmss";
      const parsed = raw.endsWith("Z")
        ? DateTime.fromFormat(raw.slice(0, -1), fmt, { zone: "utc" })
        : DateTime.fromFormat(raw, fmt, { zone: tz ?? founderZone });
      return parsed.isValid ? parsed.setZone(founderZone) : null;
    };
    const start = when(field("DTSTART"));
    const end = when(field("DTEND")) ?? start?.plus({ minutes: 30 });
    if (!start || !end || value(field("DTSTART")).length === 8) continue; // skip all-day items
    const title = value(field("SUMMARY")).replace(/\\,/g, ",").replace(/\\;/g, ";") || "Busy";
    const attendees = body
      .split(/\r?\n/)
      .filter((l) => l.startsWith("ATTENDEE"))
      .map((l) => {
        const email = value(l).replace(/^mailto:/i, "");
        const name = l.match(/CN="?([^";:]+)"?/)?.[1] ?? email;
        const domain = email.split("@")[1];
        const ownDomains = ownEmails.map((e) => e.split("@")[1]);
        return { name, email, external: ownDomains.length ? !ownDomains.includes(domain) : false };
      })
      .filter((a) => !ownEmails.includes(a.email));
    events.push({
      id: `ics${++i}`,
      title,
      start: start.toISO()!,
      end: end.toISO()!,
      category: categorize(title),
      attendees,
      agenda: value(field("DESCRIPTION")) || undefined,
      movable: !attendees.some((a) => a.external),
    });
  }
  return events.sort((a, b) => a.start.localeCompare(b.start));
}
