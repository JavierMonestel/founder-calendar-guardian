import { DateTime } from "luxon";
import { z } from "zod";
import { interpretRequest } from "@/lib/ai";
import { FOUNDER_TZ } from "@/lib/time";

const Body = z.object({ text: z.string().trim().min(5).max(1000) });

// POST { text } -> structured scheduling request (Claude when configured, rules otherwise)
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Describe the meeting in a sentence." }, { status: 400 });
  return Response.json(await interpretRequest(parsed.data.text, DateTime.now().setZone(FOUNDER_TZ)));
}
