import { DateTime } from "luxon";
import { connection } from "next/server";
import { aiEnabled } from "@/lib/ai";
import { demoWeek } from "@/lib/demo";
import { FOUNDER_TZ } from "@/lib/time";
import { GuardianGate } from "@/components/Guardian";

export default async function Home() {
  await connection(); // the demo week is relative to today
  return <GuardianGate demo={demoWeek(DateTime.now().setZone(FOUNDER_TZ))} aiOn={aiEnabled()} />;
}
