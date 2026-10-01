export const CATEGORIES = ["clinical", "performance", "company", "focus", "personal", "travel"] as const;
export type Category = (typeof CATEGORIES)[number];

/** Categories that count as "work time" for allocation targets. */
export const LINES = ["clinical", "performance", "company"] as const;
export type Line = (typeof LINES)[number];

export const CATEGORY_LABEL: Record<Category, string> = {
  clinical: "Clinical",
  performance: "Performance",
  company: "Company",
  focus: "Focus",
  personal: "Personal",
  travel: "Travel",
};

export interface Attendee {
  name: string;
  email?: string;
  external?: boolean;
  /** IANA zone, e.g. "America/Los_Angeles". Defaults to the founder's zone. */
  timezone?: string;
}

export interface CalEvent {
  id: string;
  title: string;
  start: string; // ISO with offset
  end: string;
  category: Category;
  attendees: Attendee[];
  agenda?: string;
  /** Can this be moved/declined without upsetting an external party? */
  movable?: boolean;
}

export interface Rules {
  timezone: string;
  workdayStart: string; // "09:30"
  workdayEnd: string; // "18:00"
  maxMeetingsPerDay: number;
  minFocusMinutes: number; // a free or focus block this long counts as deep work
  focusBlocksPerDay: number;
  bufferAfterExternalMinutes: number;
  maxBackToBack: number; // consecutive meetings without a 10-minute gap
  noExternalFridayAfternoon: boolean;
  /** Target share of meeting time per business line, in %. */
  allocation: Record<Line, number>;
}

export type Severity = "high" | "medium" | "low";

export interface Violation {
  rule: string;
  severity: Severity;
  day: string; // YYYY-MM-DD
  message: string;
  eventIds: string[];
  suggestion: string;
  /** A one-click fix: move this event to the best open slot elsewhere in the week. */
  fixEventId?: string;
}

export interface SchedulingRequest {
  title: string;
  durationMinutes: number;
  attendees: Attendee[];
  category: Line;
  external: boolean;
  /** Earliest and latest day to consider (YYYY-MM-DD, founder zone). */
  from: string;
  to: string;
  preference: "morning" | "afternoon" | "any";
}

export interface SlotCandidate {
  start: string;
  end: string;
  score: number;
  reasons: string[];
  /** The slot in each attendee's own zone, for the email draft. */
  local: { name: string; timezone: string; label: string }[];
}
