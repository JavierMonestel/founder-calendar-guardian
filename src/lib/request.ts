import type { DateTime } from "luxon";
import { nextWeekMonday } from "./time";
import type { Attendee, Line, SchedulingRequest } from "./types";

// Rules-based parser for scheduling requests written the way a founder types them
// in Slack: "30 min with Dr. Alan Brooks (Chicago) and Priya next week about pilot
// pricing, mornings". Claude handles messier phrasing when an API key is set.

export const TEAM: Attendee[] = [
  { name: "Dev Patel", email: "dev@example.com" },
  { name: "Priya Natarajan", email: "priya@example.com" },
  { name: "Marcus Hale", email: "marcus@example.com" },
  { name: "Javier Monestel", email: "javier@example.com" },
];

export const CITY_ZONES: Record<string, string> = {
  "new york": "America/New_York",
  nyc: "America/New_York",
  boston: "America/New_York",
  chicago: "America/Chicago",
  austin: "America/Chicago",
  denver: "America/Denver",
  boulder: "America/Denver",
  "los angeles": "America/Los_Angeles",
  la: "America/Los_Angeles",
  "san francisco": "America/Los_Angeles",
  sf: "America/Los_Angeles",
  seattle: "America/Los_Angeles",
  "mexico city": "America/Mexico_City",
  "san jose": "America/Costa_Rica",
  "costa rica": "America/Costa_Rica",
  bogota: "America/Bogota",
  "sao paulo": "America/Sao_Paulo",
  london: "Europe/London",
  berlin: "Europe/Berlin",
  madrid: "Europe/Madrid",
  paris: "Europe/Paris",
  singapore: "Asia/Singapore",
  tokyo: "Asia/Tokyo",
  sydney: "Australia/Sydney",
};

const ZONE_ABBR: Record<string, string> = { et: "America/New_York", ct: "America/Chicago", mt: "America/Denver", pt: "America/Los_Angeles" };

const CLINICAL = /\b(hospital|health system|clinic|clinical|cardiolog\w*|fda|pre-?sub|irb|patients?|regulatory|pilot|cmio|research site|study)\b/i;
const PERFORMANCE = /\b(athletes?|club|coach\w*|strap|members?|membership|growth|race|hydration|beta|creator|podcast)\b/i;

const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday"];

export function parseRequest(text: string, today: DateTime): SchedulingRequest {
  const lower = text.toLowerCase();

  const dur = lower.match(/(\d+(?:\.\d+)?)\s*(?:-|\s)?(h|hr|hrs|hour|hours|m|min|mins|minute|minutes)\b/);
  let durationMinutes = 30;
  if (dur) durationMinutes = /^h/.test(dur[2]) ? Math.round(Number(dur[1]) * 60) : Math.round(Number(dur[1]));
  durationMinutes = Math.min(240, Math.max(15, Math.round(durationMinutes / 15) * 15));

  const attendees: Attendee[] = [];
  for (const m of TEAM) {
    if (new RegExp(`\\b${m.name.split(" ")[0]}\\b`, "i").test(text)) attendees.push(m);
  }
  // External people: "Name (City)" or "Name (PT)" or "Name in City".
  for (const match of text.matchAll(/((?:Dr\.\s+)?[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\s*\(([^)]+)\)/g)) {
    const name = match[1].trim();
    if (TEAM.some((t) => t.name.startsWith(name.split(" ")[0]))) continue;
    attendees.push({ name, external: true, timezone: zoneFor(match[2]) });
  }
  for (const match of text.matchAll(/\bwith\s+((?:Dr\.\s+)?[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\s+in\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g)) {
    if (!attendees.some((a) => a.name === match[1])) attendees.push({ name: match[1], external: true, timezone: zoneFor(match[2]) });
  }

  const category: Line = CLINICAL.test(text) ? "clinical" : PERFORMANCE.test(text) ? "performance" : "company";
  const preference = /\bmorning/i.test(text) ? "morning" : /\bafternoon/i.test(text) ? "afternoon" : "any";

  let from = today.plus({ days: 1 });
  let to = today.plus({ days: 7 });
  if (/\bnext week\b/i.test(text)) {
    from = nextWeekMonday(today);
    to = from.plus({ days: 4 });
  } else if (/\bthis week\b/i.test(text)) {
    from = today.plus({ days: 1 });
    to = today.plus({ days: Math.max(1, 5 - today.weekday) });
  } else if (/\btomorrow\b/i.test(text)) {
    from = today.plus({ days: 1 });
    to = from;
  } else {
    const wd = WEEKDAYS.findIndex((d) => lower.includes(d));
    if (wd >= 0) {
      const delta = (wd + 1 - today.weekday + 7) % 7 || 7;
      from = today.plus({ days: delta });
      to = from;
    }
  }

  const about = text.match(/\b(?:about|re:|on|for)\s+([^,.;]+?)(?:,|\.|;|$|\s+(?:next|this|tomorrow|mornings?|afternoons?|on\s))/i);
  const externalNames = attendees.filter((a) => a.external).map((a) => a.name);
  const title = about
    ? capitalize(about[1].trim().replace(/^the\s+/i, ""))
    : externalNames.length
      ? `Call with ${externalNames.join(" & ")}`
      : `Sync with ${attendees.map((a) => a.name.split(" ")[0]).join(", ") || "team"}`;

  return {
    title,
    durationMinutes,
    attendees,
    category,
    external: attendees.some((a) => a.external),
    from: from.toISODate()!,
    to: to.toISODate()!,
    preference,
  };
}

export function zoneFor(hint: string): string | undefined {
  const h = hint.toLowerCase().trim();
  if (ZONE_ABBR[h]) return ZONE_ABBR[h];
  if (/^[a-z]+\/[a-z_]+$/i.test(hint.trim())) return hint.trim();
  const key = Object.keys(CITY_ZONES)
    .sort((a, b) => b.length - a.length)
    .find((c) => h.includes(c));
  return key ? CITY_ZONES[key] : undefined;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
