import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { auditWeek } from "../audit";
import { DEFAULT_RULES, demoWeek } from "../demo";
import { moveEvent } from "../fix";
import { draftEmail, holdsIcs, parseIcs } from "../outputs";
import { parseRequest, zoneFor } from "../request";
import { findSlots } from "../slots";
import { dt, nextWeekMonday, overlaps } from "../time";
import type { SchedulingRequest } from "../types";

const TODAY = DateTime.fromISO("2026-10-01T09:00:00", { zone: "America/New_York" }); // Thursday
const { monday, events } = demoWeek(TODAY);
const audit = auditWeek(events, DEFAULT_RULES, monday);
const rules = (v: string[]) => audit.violations.filter((x) => v.includes(x.rule));

describe("demo week", () => {
  it("is next week's Monday to Friday", () => {
    expect(monday).toBe("2026-10-05");
    expect(nextWeekMonday(DateTime.fromISO("2026-10-05T10:00:00"))).toEqual(DateTime.fromISO("2026-10-12T00:00:00"));
    expect(new Set(events.map((e) => dt(e.start).weekday)).size).toBe(5);
  });
});

describe("auditWeek", () => {
  it("flags overloaded days and missing focus time", () => {
    expect(rules(["Max meetings per day"]).map((v) => v.day)).toEqual(["2026-10-05", "2026-10-07"]);
    const focus = rules(["Daily focus block"]);
    expect(focus.map((v) => v.day)).toEqual(["2026-10-05"]);
    expect(focus[0].suggestion).toContain("“1:1 Dev”");
  });

  it("flags meetings outside working hours, Friday-afternoon externals and missing agendas", () => {
    const hours = rules(["Working hours"]).map((v) => v.message);
    expect(hours.some((m) => m.includes("Investor coffee (early)"))).toBe(true);
    expect(hours.some((m) => m.includes("Late call: Asia distributor"))).toBe(true);
    expect(rules(["No external calls Friday afternoon"])).toHaveLength(1);
    expect(rules(["Agenda for external meetings"]).every((v) => !v.message.includes("Northfield"))).toBe(true);
  });

  it("finds back-to-back chains and missing buffers after external calls", () => {
    const chains = rules(["Back-to-back meetings"]);
    expect(chains.map((v) => v.eventIds.length)).toEqual([4, 5]);
    expect(rules(["Buffer after external calls"]).length).toBeGreaterThan(0);
  });

  it("scores with a per-rule cap and computes allocation", () => {
    expect(audit.score).toBeGreaterThan(0);
    expect(audit.score).toBeLessThan(50);
    const { allocation } = audit.totals;
    expect(allocation.clinical + allocation.performance + allocation.company).toBeGreaterThanOrEqual(99);
  });

  it("a perfect week scores 100", () => {
    const calm = events.filter((e) => e.category === "focus");
    expect(auditWeek(calm, { ...DEFAULT_RULES, allocation: { clinical: 34, performance: 33, company: 33 } }, monday).score).toBe(100);
  });
});

describe("one-click fixes", () => {
  it("moving the suggested meeting raises the score and keeps rules", () => {
    const v = audit.violations.find((x) => x.rule === "Daily focus block")!;
    const result = moveEvent(events, v.fixEventId!, DEFAULT_RULES, monday);
    expect(result.moved).toBe(true);
    const after = auditWeek(result.events, DEFAULT_RULES, monday);
    expect(after.score).toBeGreaterThan(audit.score);
    expect(after.violations.some((x) => x.rule === "Daily focus block" && x.day === "2026-10-05")).toBe(false);
    const moved = result.events.find((e) => e.id === v.fixEventId)!;
    expect(dt(moved.start).toISODate()).not.toBe("2026-10-05");
  });
});

describe("parseRequest", () => {
  it("reads duration, people, zones, range and preference", () => {
    const r = parseRequest("30 min with Dr. Alan Brooks (Chicago) and Priya next week about pilot pricing, mornings preferred", TODAY);
    expect(r).toMatchObject({ title: "Pilot pricing", durationMinutes: 30, category: "clinical", external: true, from: "2026-10-05", to: "2026-10-09", preference: "morning" });
    expect(r.attendees.map((a) => [a.name, a.timezone])).toEqual([
      ["Priya Natarajan", undefined],
      ["Dr. Alan Brooks", "America/Chicago"],
    ]);
  });

  it("handles hours, weekdays and zone abbreviations", () => {
    const r = parseRequest("1 hour with Nora Lindqvist (PT) on Tuesday about the seed extension", TODAY);
    expect(r.durationMinutes).toBe(60);
    expect([r.from, r.to]).toEqual(["2026-10-06", "2026-10-06"]);
    expect(r.attendees[0].timezone).toBe("America/Los_Angeles");
    expect(r.category).toBe("company");
    expect(zoneFor("San Jose, Costa Rica")).toBe("America/Costa_Rica");
  });
});

describe("findSlots", () => {
  const req: SchedulingRequest = parseRequest("30 min with Dr. Alan Brooks (Chicago) and Priya next week about pilot pricing, mornings", TODAY);
  const slots = findSlots(req, events, DEFAULT_RULES);

  it("never overlaps existing events, focus blocks included", () => {
    expect(slots.length).toBeGreaterThan(2);
    for (const s of slots) for (const e of events) expect(overlaps(s.start, s.end, e.start, e.end)).toBe(false);
  });

  it("stays inside the founder's workday and the guest's local working hours", () => {
    for (const s of slots) {
      const start = dt(s.start);
      expect(start.hour * 60 + start.minute).toBeGreaterThanOrEqual(9 * 60 + 30);
      const local = dt(s.start).setZone("America/Chicago");
      expect(local.hour).toBeGreaterThanOrEqual(9);
      expect(local.hour).toBeLessThan(17);
    }
  });

  it("respects the protected Friday afternoon and the buffer after external calls", () => {
    const friday = findSlots({ ...req, from: "2026-10-09", to: "2026-10-09", preference: "afternoon" }, events, DEFAULT_RULES);
    expect(friday.every((s) => dt(s.start).hour < 12)).toBe(true);
    const external = events.filter((e) => e.attendees.some((a) => a.external));
    for (const s of slots) for (const e of external) expect(dt(s.start).diff(dt(e.end), "minutes").minutes === 0).toBe(false);
  });

  it("returns at most two options per day, with reasons", () => {
    const perDay = new Map<string, number>();
    for (const s of slots) perDay.set(s.start.slice(0, 10), (perDay.get(s.start.slice(0, 10)) ?? 0) + 1);
    expect(Math.max(...perDay.values())).toBeLessThanOrEqual(2);
    expect(slots.every((s) => s.reasons.length > 0)).toBe(true);
  });

  it("writes the email in the guest's time zone and creates holds", () => {
    const email = draftEmail(req, slots, "America/New_York");
    expect(email.body).toMatch(/^Hi Dr\. Brooks,/);
    expect(email.body).toContain("CDT");
    const ics = holdsIcs(req, slots, DateTime.utc(2026, 10, 1));
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(3);
    expect(ics).toContain("STATUS:TENTATIVE");
  });
});

describe("parseIcs", () => {
  it("reads UTC, TZID and folded lines, skips all-day items and marks external guests", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART:20261006T140000Z",
      "DTEND:20261006T143000Z",
      "SUMMARY:Pilot call with Northfield hospital",
      "ATTENDEE;CN=Alan Brooks:mailto:alan@northfield.example",
      "ATTENDEE;CN=Sam:mailto:sam@ourco.example",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "DTSTART;TZID=America/Los_Angeles:20261007T090000",
      "DTEND;TZID=America/Los_Angeles:20261007T100000",
      "SUMMARY:Focus: writing",
      " time for the deck",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "DTSTART;VALUE=DATE:20261008",
      "SUMMARY:Holiday",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const parsed = parseIcs(ics, "America/New_York", ["sam@ourco.example"]);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({ category: "clinical", movable: false });
    expect(dt(parsed[0].start).toFormat("HH:mm")).toBe("10:00");
    expect(parsed[0].attendees).toEqual([{ name: "Alan Brooks", email: "alan@northfield.example", external: true }]);
    expect(parsed[1].title).toBe("Focus: writingtime for the deck");
    expect(parsed[1].category).toBe("focus");
    expect(dt(parsed[1].start).toFormat("HH:mm")).toBe("12:00");
  });
});

describe("option diversity", () => {
  it("keeps same-day options at least an hour apart", () => {
    const req = parseRequest("30 min with Dr. Alan Brooks (Chicago) and Priya next week about pilot pricing, mornings", TODAY);
    const slots = findSlots(req, events, DEFAULT_RULES);
    for (const a of slots)
      for (const b of slots)
        if (a !== b && a.start.slice(0, 10) === b.start.slice(0, 10)) expect(Math.abs(dt(a.start).diff(dt(b.start), "minutes").minutes)).toBeGreaterThanOrEqual(60);
  });
});
