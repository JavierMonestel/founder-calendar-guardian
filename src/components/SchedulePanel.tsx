"use client";

import { useState } from "react";
import { label, shortName } from "@/lib/slots";
import { holdsIcs } from "@/lib/outputs";
import type { Rules, SchedulingRequest, SlotCandidate } from "@/lib/types";
import { btn, cn, input, Panel, Spinner } from "./ui";

const SAMPLES = [
  "30 min with Dr. Alan Brooks (Chicago) and Priya next week about pilot pricing, mornings preferred",
  "45-minute call with Elena Ruiz (Denver) and Marcus next week about the club team plan, afternoons",
  "1 hour with Dev and Priya next week about the FDA pre-sub narrative",
  "30 min with Nora Lindqvist (London) next week about the seed extension",
];

export interface ScheduleResult {
  engine: "claude" | "rules";
  request: SchedulingRequest;
  slots: SlotCandidate[];
  email: { to: string[]; subject: string; body: string } | null;
}

export function SchedulePanel({
  rules,
  aiOn,
  result,
  loading,
  error,
  onFind,
  onBook,
  onHover,
}: {
  rules: Rules;
  aiOn: boolean;
  result: ScheduleResult | null;
  loading: boolean;
  error: string | null;
  onFind: (text: string) => void;
  onBook: (slot: SlotCandidate) => void;
  onHover: (slot: SlotCandidate | null) => void;
}) {
  const [text, setText] = useState(SAMPLES[0]);
  const [copied, setCopied] = useState(false);

  const download = () => {
    if (!result) return;
    const url = URL.createObjectURL(new Blob([holdsIcs(result.request, result.slots)], { type: "text/calendar" }));
    Object.assign(document.createElement("a"), { href: url, download: "meeting-holds.ics" }).click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <Panel>
        <label htmlFor="req" className="text-[13px] font-semibold text-slate-900">
          Who, how long, roughly when?
        </label>
        <textarea id="req" rows={3} value={text} onChange={(e) => setText(e.target.value)} className={cn(input, "mt-2 resize-none")} />
        <div className="mt-2 flex flex-wrap gap-1">
          {SAMPLES.map((s, i) => (
            <button key={s} type="button" onClick={() => setText(s)} className={btn.ghost}>
              Example {i + 1}
            </button>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-[11px] text-slate-500">{aiOn ? "Understood by Claude" : "Rules-based parser (demo mode)"}</span>
          <button type="button" className={btn.primary} disabled={loading || text.trim().length < 5} onClick={() => onFind(text)}>
            {loading && <Spinner />} Find times
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
      </Panel>

      {result && (
        <>
          <Panel>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Understood as</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">
              {result.request.title} · {result.request.durationMinutes} min
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
              {result.request.attendees.map((a) => (
                <span key={a.name} className={cn("rounded-full px-2 py-0.5", a.external ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-700")}>
                  {a.name}
                  {a.timezone && a.timezone !== rules.timezone ? ` · ${a.timezone.split("/")[1].replace("_", " ")}` : ""}
                </span>
              ))}
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                {result.request.from} → {result.request.to}
              </span>
              {result.request.preference !== "any" && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{result.request.preference}s</span>}
            </div>
          </Panel>

          <Panel className="p-0">
            <div className="border-b border-slate-100 px-4 py-3 text-[13px] font-semibold text-slate-900">
              {result.slots.length ? `Best ${result.slots.length} options (founder time, ET)` : "No slot fits every rule in that range. Widen the dates or relax a rule."}
            </div>
            <ol className="divide-y divide-slate-100">
              {result.slots.map((s, i) => (
                <li key={s.start} className="px-4 py-3" onMouseEnter={() => onHover(s)} onMouseLeave={() => onHover(null)}>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="mr-2 rounded bg-violet-100 px-1.5 py-0.5 text-[11px] font-semibold text-violet-800">Option {i + 1}</span>
                      <span className="text-sm font-medium text-slate-900">{label(s.start, s.end, rules.timezone)}</span>
                    </div>
                    <button type="button" className={btn.small} onClick={() => onBook(s)}>
                      Book
                    </button>
                  </div>
                  {s.local.map((l) => (
                    <div key={l.name} className="mt-1 text-xs text-slate-500">
                      For {shortName(l.name)}: {l.label}
                    </div>
                  ))}
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {s.reasons.map((r) => (
                      <span key={r} className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10.5px] text-emerald-800">
                        {r}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ol>
          </Panel>

          {result.email && (
            <Panel>
              <div className="flex items-center justify-between gap-2">
                <div className="text-[13px] font-semibold text-slate-900">Email draft</div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    className={btn.small}
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(`Subject: ${result.email!.subject}\n\n${result.email!.body}`);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1500);
                      } catch {}
                    }}
                  >
                    {copied ? "Copied ✓" : "Copy"}
                  </button>
                  <button type="button" className={btn.small} onClick={download}>
                    ⬇ Holds (.ics)
                  </button>
                </div>
              </div>
              <div className="mt-2 text-xs text-slate-500">
                To: {result.email.to.join(", ")} · {result.email.subject}
              </div>
              <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 font-sans text-[13px] leading-relaxed text-slate-700">{result.email.body}</pre>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
