import { z } from "zod";
import { CATEGORIES, LINES } from "./types";

export const AttendeeSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().max(200).optional(),
  external: z.boolean().optional(),
  timezone: z.string().max(60).optional(),
});

export const EventSchema = z.object({
  id: z.string().max(80),
  title: z.string().max(300),
  start: z.string().max(40),
  end: z.string().max(40),
  category: z.enum(CATEGORIES),
  attendees: z.array(AttendeeSchema).max(100),
  agenda: z.string().max(5000).optional(),
  movable: z.boolean().optional(),
});

export const RulesSchema = z.object({
  timezone: z.string().max(60),
  workdayStart: z.string().regex(/^\d{2}:\d{2}$/),
  workdayEnd: z.string().regex(/^\d{2}:\d{2}$/),
  maxMeetingsPerDay: z.number().int().min(1).max(20),
  minFocusMinutes: z.number().int().min(15).max(480),
  focusBlocksPerDay: z.number().int().min(0).max(4),
  bufferAfterExternalMinutes: z.number().int().min(0).max(60),
  maxBackToBack: z.number().int().min(1).max(10),
  noExternalFridayAfternoon: z.boolean(),
  allocation: z.object(Object.fromEntries(LINES.map((l) => [l, z.number().min(0).max(100)])) as Record<(typeof LINES)[number], z.ZodNumber>),
});

export const RequestSchema = z.object({
  title: z.string().min(1).max(200),
  durationMinutes: z.number().int().min(15).max(240),
  attendees: z.array(AttendeeSchema).max(20),
  category: z.enum(LINES),
  external: z.boolean(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  preference: z.enum(["morning", "afternoon", "any"]),
});

export const WeekSchema = z.object({
  monday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  events: z.array(EventSchema).max(500),
  rules: RulesSchema,
});
