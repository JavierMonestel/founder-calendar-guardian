import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { DateTime, IANAZone } from "luxon";
import { z } from "zod";
import { parseRequest, TEAM } from "./request";
import type { SchedulingRequest } from "./types";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5";
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

export function aiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic());

const RequestSchema = z.object({
  title: z.string().describe("Short meeting title, e.g. 'Pilot pricing'"),
  durationMinutes: z.number().int().describe("Duration in minutes, default 30"),
  attendees: z.array(
    z.object({
      name: z.string(),
      external: z.boolean().describe("True for anyone outside the company"),
      timezone: z.string().nullable().describe("IANA zone like America/Chicago, inferred from a city or zone mentioned; null if unknown"),
    }),
  ),
  category: z.enum(["clinical", "performance", "company"]),
  from: z.string().describe("First acceptable day, YYYY-MM-DD"),
  to: z.string().describe("Last acceptable day, YYYY-MM-DD"),
  preference: z.enum(["morning", "afternoon", "any"]),
});

export async function interpretRequest(text: string, today: DateTime): Promise<{ engine: "claude" | "rules"; request: SchedulingRequest }> {
  if (!aiEnabled()) return { engine: "rules", request: parseRequest(text, today) };
  try {
    const response = await getClient().beta.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      output_config: { effort: "low", format: betaZodOutputFormat(RequestSchema) },
      system:
        `You turn a founder's scheduling request into structured constraints. Today is ${today.toFormat("cccc, yyyy-LL-dd")} (America/New_York). ` +
        `Internal team: Sam Rivera (the founder; never list Sam as an attendee), ${TEAM.map((t) => t.name).join(", ")}. ` +
        `Business lines: clinical (health systems, research sites, regulatory), performance (athletes, clubs, devices, growth), company (investors, hiring, ops). ` +
        `"Next week" means Monday to Friday of next week. Only weekdays. Do not invent attendees.`,
      messages: [{ role: "user", content: text }],
    });
    const out = response.parsed_output;
    if (response.stop_reason === "refusal" || !out) throw new Error("no parsed output");
    const valid = (d: string) => DateTime.fromISO(d).isValid;
    const request: SchedulingRequest = {
      title: out.title.slice(0, 120),
      durationMinutes: Math.min(240, Math.max(15, Math.round(out.durationMinutes / 15) * 15)),
      attendees: out.attendees.map((a) => {
        const team = TEAM.find((t) => t.name.toLowerCase() === a.name.toLowerCase());
        return team ?? { name: a.name, external: a.external, timezone: a.timezone && IANAZone.isValidZone(a.timezone) ? a.timezone : undefined };
      }),
      category: out.category,
      external: out.attendees.some((a) => a.external),
      from: valid(out.from) ? out.from : today.plus({ days: 1 }).toISODate()!,
      to: valid(out.to) ? out.to : today.plus({ days: 7 }).toISODate()!,
      preference: out.preference,
    };
    return { engine: "claude", request };
  } catch (error) {
    if (error instanceof Anthropic.APIError) console.error(`[calendar] Anthropic API error ${error.status}`);
    else console.error("[calendar]", error);
    return { engine: "rules", request: parseRequest(text, today) };
  }
}
