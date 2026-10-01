import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Founder Calendar Guardian",
  description: "Audit a founder's week against their operating rules, fix it in one click, and find meeting times across time zones without breaking focus time.",
};

const REPO = "https://github.com/JavierMonestel/founder-calendar-guardian";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} antialiased`}>
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-center text-xs text-amber-800">
          Demo with a fictional founder calendar · independent portfolio project, not affiliated with any company.
        </div>
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-2.5">
              <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
                <rect width="32" height="32" rx="8" fill="#0f172a" />
                <rect x="7" y="9" width="18" height="16" rx="3" fill="none" stroke="#94a3b8" strokeWidth="2" />
                <path d="M7 14h18M12 6v5M20 6v5" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
                <path d="m12.5 19.5 2.5 2.5 4.5-5" fill="none" stroke="#34d399" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="leading-tight">
                <div className="text-sm font-semibold">Founder OS · Calendar Guardian</div>
                <div className="text-xs text-slate-500">Protect focus time, honor the operating rules, schedule across time zones</div>
              </div>
            </div>
            <a href={REPO} target="_blank" rel="noopener" className="rounded-md px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
              GitHub ↗
            </a>
          </div>
        </header>
        <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6">{children}</main>
        <footer className="pb-8 text-center text-xs text-slate-400">Built by Javier Monestel · Next.js · Luxon · Claude API</footer>
      </body>
    </html>
  );
}
