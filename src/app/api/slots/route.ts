import { z } from "zod";
import { draftEmail } from "@/lib/outputs";
import { findSlots } from "@/lib/slots";
import { EventSchema, RequestSchema, RulesSchema } from "@/lib/validation";

const Body = z.object({ request: RequestSchema, events: z.array(EventSchema).max(500), rules: RulesSchema });

// POST { request, events, rules } -> ranked slots (with reasons) + an email draft
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid request", detail: parsed.error.flatten().fieldErrors }, { status: 400 });
  const { request: req, events, rules } = parsed.data;
  const slots = findSlots(req, events, rules);
  return Response.json({ slots, email: slots.length ? draftEmail(req, slots, rules.timezone) : null });
}
