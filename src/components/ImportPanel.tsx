"use client";

import { useState } from "react";
import type { CalEvent } from "@/lib/types";
import { btn, input, Panel, Spinner } from "./ui";

export function ImportPanel({ onImported, onReset }: { onImported: (monday: string, events: CalEvent[], skipped: number) => void; onReset: () => void }) {
  const [email, setEmail] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const upload = async () => {
    if (!file) return;
    setLoading(true);
    setStatus(null);
    try {
      const form = new FormData();
      form.set("file", file);
      if (email.trim()) form.set("email", email.trim());
      const res = await fetch("/api/import", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Import failed (${res.status})`);
      onImported(data.monday, data.events, data.skipped ?? 0);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Panel>
        <div className="text-[13px] font-semibold text-slate-900">Audit your own week</div>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          Export a week from Google Calendar, Outlook or Apple Calendar as <code>.ics</code> and drop it here. It is parsed in memory to build the view and is
          never stored. Meetings are categorized by keywords; attendees outside your email domain count as external.
        </p>
        <div className="mt-3 space-y-2">
          <input type="file" accept=".ics,text/calendar" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white" />
          <input type="email" placeholder="Your email (to tell internal from external)" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
          <button type="button" className={btn.primary} disabled={!file || loading} onClick={upload}>
            {loading && <Spinner />} Import week
          </button>
        </div>
        {status && <p className="mt-2 text-sm text-slate-700">{status}</p>}
      </Panel>
      <Panel>
        <div className="text-[13px] font-semibold text-slate-900">Back to the demo</div>
        <p className="mt-1 text-xs text-slate-500">Restore the fictional founder week and default rules.</p>
        <button type="button" className={`${btn.secondary} mt-3`} onClick={onReset}>
          Reset demo week
        </button>
      </Panel>
    </div>
  );
}
