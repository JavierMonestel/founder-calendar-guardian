import { DateTime } from "luxon";
import { parseIcs } from "@/lib/outputs";
import { FOUNDER_TZ } from "@/lib/time";

// POST multipart { file: .ics, email? } -> events for the week of the first event.
// The file is parsed in memory and never stored.
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Attach an .ics file." }, { status: 400 });
  if (file.size > 2_000_000) return Response.json({ error: "File too large (2 MB max)." }, { status: 413 });
  const own = String(form?.get("email") ?? "").trim();
  const events = parseIcs(await file.text(), FOUNDER_TZ, own ? [own] : []);
  if (!events.length) return Response.json({ error: "No timed events found in that file." }, { status: 422 });
  // Pick the busiest Monday-to-Friday week in the file.
  const byWeek = new Map<string, number>();
  for (const e of events) {
    const monday = DateTime.fromISO(e.start).setZone(FOUNDER_TZ).startOf("week").toISODate()!;
    byWeek.set(monday, (byWeek.get(monday) ?? 0) + 1);
  }
  const monday = [...byWeek.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const end = DateTime.fromISO(monday, { zone: FOUNDER_TZ }).plus({ days: 5 });
  const week = events.filter((e) => {
    const s = DateTime.fromISO(e.start).setZone(FOUNDER_TZ);
    return s >= DateTime.fromISO(monday, { zone: FOUNDER_TZ }) && s < end;
  });
  return Response.json({ monday, events: week, skipped: events.length - week.length });
}
