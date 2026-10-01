import { DateTime } from "luxon";
import { at, FOUNDER_TZ, nextWeekMonday, weekdays } from "./time";
import type { CalEvent, Category, Rules } from "./types";

// A fictional founder week, generated relative to "next Monday" so the demo is
// always current. It is deliberately a little broken (that's what the audit is for).

export const DEFAULT_RULES: Rules = {
  timezone: FOUNDER_TZ,
  workdayStart: "09:30",
  workdayEnd: "18:00",
  maxMeetingsPerDay: 6,
  minFocusMinutes: 90,
  focusBlocksPerDay: 1,
  bufferAfterExternalMinutes: 10,
  maxBackToBack: 3,
  noExternalFridayAfternoon: true,
  allocation: { clinical: 40, performance: 35, company: 25 },
};

const TEAM = {
  dev: { name: "Dev Patel", email: "dev@example.com" },
  priya: { name: "Priya Natarajan", email: "priya@example.com" },
  marcus: { name: "Marcus Hale", email: "marcus@example.com" },
  javier: { name: "Javier Monestel", email: "javier@example.com" },
};

type Spec = [day: number, start: string, end: string, title: string, category: Category, attendees: CalEvent["attendees"], extra?: Partial<CalEvent>];

const SPECS: Spec[] = [
  // Monday: back-to-back morning, no focus time
  [0, "09:30", "10:00", "Leadership sync", "company", [TEAM.dev, TEAM.priya, TEAM.marcus, TEAM.javier], { agenda: "Blockers, decisions, metrics", movable: false }],
  [0, "10:00", "10:45", "Clinical pipeline review", "clinical", [TEAM.priya], { agenda: "Pilot pipeline + IRB status", movable: true }],
  [0, "10:45", "11:30", "Athlete onboarding funnel review", "performance", [TEAM.marcus], { movable: true }],
  [0, "11:30", "12:15", "Northfield Health – security review", "clinical", [{ name: "Dr. Alan Brooks", external: true, timezone: "America/Chicago" }, TEAM.priya], { agenda: "Questionnaire walkthrough", movable: false }],
  [0, "13:00", "13:30", "1:1 Dev", "company", [TEAM.dev], { movable: true }],
  [0, "14:00", "14:45", "Strap OEM partnership call", "performance", [{ name: "OEM partnerships lead", external: true, timezone: "Europe/Berlin" }, TEAM.marcus], { movable: false }],
  [0, "15:00", "15:30", "Recruiter screen debrief", "company", [TEAM.javier], { movable: true }],
  [0, "16:00", "16:30", "Podcast prep", "performance", [TEAM.marcus], { movable: true }],
  [0, "16:45", "17:30", "Investor pipeline review", "company", [TEAM.javier], { movable: true }],
  // Tuesday: protected deep work in the morning
  [1, "09:30", "11:30", "Focus: pre-sub narrative", "focus", []],
  [1, "12:00", "12:45", "Lunch with advisor", "personal", [{ name: "Sports cardiology advisor", external: true }]],
  [1, "14:00", "14:30", "1:1 Priya", "clinical", [TEAM.priya], { movable: true }],
  [1, "15:00", "15:45", "Summit Endurance Club – team plan", "performance", [{ name: "Elena Ruiz", external: true, timezone: "America/Denver" }, TEAM.marcus], { movable: false }],
  // Wednesday: overloaded with external calls, no buffer
  [2, "09:00", "09:30", "Investor coffee (early)", "company", [{ name: "Nora Lindqvist", external: true }], { movable: false }],
  [2, "09:30", "10:15", "Cedar Valley research site", "clinical", [{ name: "Grace Okafor", external: true, timezone: "America/Chicago" }, TEAM.priya], { movable: false }],
  [2, "10:15", "11:00", "Regulatory consultant", "clinical", [{ name: "Regulatory consultant", external: true }, TEAM.priya, TEAM.dev], { agenda: "Pre-sub sections 1–5", movable: false }],
  [2, "11:00", "11:30", "Growth experiment readout", "performance", [TEAM.marcus], { movable: true }],
  [2, "11:30", "12:00", "Hiring sync", "company", [TEAM.javier, TEAM.dev], { movable: true }],
  [2, "13:30", "14:15", "Pilot pricing workshop", "clinical", [TEAM.priya, TEAM.javier], { movable: true }],
  [2, "14:30", "15:00", "Creator partnership intro", "performance", [{ name: "Creator agency", external: true, timezone: "America/Los_Angeles" }], { movable: true }],
  [2, "16:00", "16:30", "Board deck review", "company", [TEAM.javier], { movable: true }],
  [2, "18:30", "19:15", "Late call: Asia distributor", "performance", [{ name: "Distributor", external: true, timezone: "Asia/Singapore" }], { movable: true }],
  // Thursday: lighter, one focus block
  [3, "10:00", "10:30", "1:1 Marcus", "performance", [TEAM.marcus], { movable: true }],
  [3, "11:00", "13:00", "Focus: investor update", "focus", []],
  [3, "14:00", "15:00", "All-hands", "company", [TEAM.dev, TEAM.priya, TEAM.marcus, TEAM.javier], { agenda: "Q4 OKR check-in", movable: false }],
  // Friday: external call in the protected afternoon
  [4, "10:00", "10:45", "Clinical advisory board prep", "clinical", [TEAM.priya], { movable: true }],
  [4, "14:00", "14:45", "Vendor demo: ECG data platform", "clinical", [{ name: "Vendor AE", external: true }], { movable: true }],
  [4, "15:00", "17:00", "Focus: weekly review", "focus", []],
];

export function demoWeek(today: DateTime = DateTime.now().setZone(FOUNDER_TZ)): { monday: string; events: CalEvent[] } {
  const monday = nextWeekMonday(today.setZone(FOUNDER_TZ));
  const days = weekdays(monday);
  const events = SPECS.map(([d, s, e, title, category, attendees, extra], i) => ({
    id: `e${i + 1}`,
    title,
    start: at(days[d], s).toISO()!,
    end: at(days[d], e).toISO()!,
    category,
    attendees,
    ...extra,
  }));
  return { monday: monday.toISODate()!, events };
}
