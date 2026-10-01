import { auditWeek } from "@/lib/audit";
import { WeekSchema } from "@/lib/validation";

// POST { monday, events, rules } -> health score, violations with suggested fixes, totals
export async function POST(request: Request) {
  const parsed = WeekSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid week", detail: parsed.error.flatten().fieldErrors }, { status: 400 });
  const { monday, events, rules } = parsed.data;
  return Response.json(auditWeek(events, rules, monday));
}
