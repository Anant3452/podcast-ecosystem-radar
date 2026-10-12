import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Podcast Ecosystem Radar",
  description:
    "A weekly brief on guests, topics and sponsors across 10 Indian startup podcasts, built with Gemini Flash.",
};

export const viewport: Viewport = { themeColor: "#0a0a0c", colorScheme: "dark" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full">
      <body className="relative flex min-h-full flex-col font-sans">
        <div aria-hidden className="ambient-glow pointer-events-none absolute inset-x-0 top-0 h-[720px]" />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-bg-raised focus:px-4 focus:py-2 focus:text-sm"
        >
          Skip to content
        </a>
        <header className="sticky top-0 z-40 border-b border-border bg-bg/70 backdrop-blur-xl backdrop-saturate-150">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
            <Link href="/" className="group flex shrink-0 items-center gap-2.5" aria-label="Podcast Ecosystem Radar, home">
              <RadarMark />
              <span className="hidden text-[15px] font-semibold tracking-tight sm:inline">Ecosystem Radar</span>
            </Link>
            <Nav />
          </div>
        </header>
        <main id="main" className="relative mx-auto w-full max-w-6xl flex-1 px-5 pb-24 pt-10 sm:px-8 sm:pt-16">
          {children}
        </main>
        <footer className="relative border-t border-border">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-8 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <span>Podcast Ecosystem Radar</span>
            <span className="text-faint">
              Live RSS · Google Gemini Flash · Delivered Mondays, 6:00 AM IST
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}

function RadarMark() {
  return (
    <span className="relative grid h-7 w-7 place-items-center rounded-full border border-border bg-surface transition-colors duration-300 ease-fluid group-hover:border-border-strong">
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className="text-accent">
        <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeOpacity=".35" />
        <circle cx="8" cy="8" r="3.5" fill="none" stroke="currentColor" strokeOpacity=".6" />
        <circle cx="8" cy="8" r="1.3" fill="currentColor" />
        <path
          d="M8 8 L13.4 4.2"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          className="origin-[8px_8px] transition-transform duration-700 ease-fluid group-hover:rotate-[60deg]"
        />
      </svg>
    </span>
  );
}
