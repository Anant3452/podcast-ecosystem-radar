import type { Metadata } from "next";
import Link from "next/link";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Podcast Ecosystem Radar",
  description:
    "A weekly brief on guests, topics and sponsors across 10 Indian startup podcasts, built with Gemini Flash.",
};

const NAV = [
  { href: "/", label: "This week" },
  { href: "/archive", label: "Archive" },
  { href: "/shows", label: "Shows" },
  { href: "/admin", label: "Admin" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <header className="border-b border-line">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
            <Link href="/" className="group flex items-center gap-2.5">
              <RadarMark />
              <span className="font-display text-lg font-semibold tracking-tight">Podcast Ecosystem Radar</span>
            </Link>
            <nav className="flex gap-1 text-sm">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="rounded-full px-3 py-1.5 text-ink-2 transition hover:bg-paper-2 hover:text-ink"
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-12">{children}</main>
        <footer className="border-t border-line">
          <div className="mx-auto max-w-5xl px-4 py-6 text-xs text-muted sm:px-6">
            Live RSS from 10 Indian startup and creator podcasts · extraction and writing by Google Gemini Flash ·
            delivered every Monday 6:00 AM IST
          </div>
        </footer>
      </body>
    </html>
  );
}

function RadarMark() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden className="text-radar">
      <circle cx="13" cy="13" r="11.5" fill="none" stroke="currentColor" strokeOpacity=".35" />
      <circle cx="13" cy="13" r="7" fill="none" stroke="currentColor" strokeOpacity=".55" />
      <circle cx="13" cy="13" r="2.2" fill="currentColor" />
      <path d="M13 13 L22.5 6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
