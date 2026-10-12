import { SECTION_META, type BriefContent, type BriefItem, type SectionKey } from "@/lib/brief";
import { Card, EmptyState, Eyebrow, Pill } from "@/components/ui";

type Tone = { text: string; soft: string; dot: string; num: string; glow: string };

const TONE: Record<SectionKey, Tone> = {
  guests: { text: "text-guests", soft: "bg-guests-soft", dot: "bg-guests", num: "01", glow: "group-hover:shadow-[0_0_0_1px_rgba(229,146,106,0.25)]" },
  topics: { text: "text-topics", soft: "bg-topics-soft", dot: "bg-topics", num: "02", glow: "group-hover:shadow-[0_0_0_1px_rgba(92,200,168,0.25)]" },
  sponsors: { text: "text-sponsors", soft: "bg-sponsors-soft", dot: "bg-sponsors", num: "03", glow: "group-hover:shadow-[0_0_0_1px_rgba(169,156,240,0.25)]" },
};

const KEYS: SectionKey[] = ["guests", "topics", "sponsors"];

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

export function BriefView({ brief, emailedAt }: { brief: BriefContent; emailedAt?: Date | null }) {
  const week = new Date(brief.week_of).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  return (
    <article>
      {/* Hero */}
      <section className="pb-16 pt-4 sm:pb-24">
        <div className="animate-rise">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <Eyebrow>Week of {week}</Eyebrow>
            {emailedAt && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-topics-soft px-2.5 py-0.5 text-[11px] font-medium text-topics">
                <span className="h-1.5 w-1.5 rounded-full bg-topics" aria-hidden />
                Delivered
              </span>
            )}
          </div>
          <h1 className="mt-5 font-display text-[2.6rem] font-semibold leading-[1.05] tracking-[-0.035em] sm:text-6xl lg:text-7xl">
            This week,
            <br />
            <span className="text-muted">in one line.</span>
          </h1>
          <p className="mt-8 max-w-3xl text-lg leading-relaxed text-text-2 sm:text-xl sm:leading-relaxed">
            {brief.headline}
          </p>

          <nav aria-label="Brief sections" className="mt-12 grid max-w-3xl grid-cols-3 gap-3">
            {KEYS.map((k) => (
              <a
                key={k}
                href={`#${k}`}
                className="group rounded-2xl border border-border bg-surface px-4 py-4 backdrop-blur-xl transition-[border-color,background-color,transform] duration-300 ease-fluid hover:-translate-y-0.5 hover:border-border-strong hover:bg-surface-hover sm:px-5"
              >
                <span className={`block text-[11px] font-medium uppercase tracking-[0.14em] ${TONE[k].text}`}>{k}</span>
                <span className="mt-2 block font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                  {brief.sections[k].length}
                </span>
                <span className="mt-1 hidden text-xs text-muted sm:block">{SECTION_META[k].label}</span>
              </a>
            ))}
          </nav>

          <p className="mt-6 text-xs leading-relaxed text-faint">
            {brief.stats.episodes_considered} episodes across {brief.stats.shows_with_episodes} shows · guests over{" "}
            {brief.windows.guest.days} days · topics over {brief.windows.topic.days} days · sponsors over{" "}
            {brief.windows.brand.days} days
            {brief.generated_by === "fallback" ? " · written by deterministic fallback (Gemini unavailable)" : ""}
          </p>
        </div>
      </section>

      {KEYS.map((k) => (
        <Section key={k} sectionKey={k} items={brief.sections[k]} />
      ))}
    </article>
  );
}

function Section({ sectionKey, items }: { sectionKey: SectionKey; items: BriefItem[] }) {
  const meta = SECTION_META[sectionKey];
  const tone = TONE[sectionKey];
  return (
    <section id={sectionKey} aria-labelledby={`${sectionKey}-title`} className="scroll-mt-24 border-t border-border py-16 sm:py-24">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,280px)_1fr] lg:gap-16">
        <header className="lg:sticky lg:top-28 lg:self-start">
          <span className={`font-mono text-xs ${tone.text}`}>{tone.num}</span>
          <h2 id={`${sectionKey}-title`} className="mt-3 font-display text-3xl font-semibold tracking-[-0.025em] sm:text-4xl">
            {meta.label}
          </h2>
          <p className="mt-3 leading-relaxed text-muted">{meta.question}</p>
        </header>

        {items.length === 0 ? (
          <EmptyState title="Nothing qualified this week">{meta.empty}</EmptyState>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {items.map((it, i) => (
              <li key={it.ref} className="animate-rise" style={{ animationDelay: `${Math.min(i, 6) * 60}ms` }}>
                <ItemCard item={it} tone={tone} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function ItemCard({ item, tone }: { item: BriefItem; tone: Tone }) {
  const n = item.episodes.length;
  return (
    <Card interactive className={`group flex h-full flex-col p-6 ${tone.glow}`}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-xl font-semibold leading-snug tracking-[-0.015em]">{item.title}</h3>
        <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${tone.dot} opacity-80`} aria-hidden />
      </div>
      {item.meta && <p className="mt-1 text-xs text-muted">{item.meta}</p>}

      <p className="mt-4 text-[15px] leading-relaxed text-text-2">{item.insight}</p>

      <div className={`mt-5 rounded-xl ${tone.soft} px-4 py-3`}>
        <p className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${tone.text}`}>Next step</p>
        <p className="mt-1 text-sm leading-relaxed text-text">{item.action}</p>
      </div>

      <div className="mt-5 flex flex-wrap gap-1.5">
        {item.shows.map((sh) => (
          <Pill key={sh.show_id}>{sh.show_name}</Pill>
        ))}
      </div>

      <details className="group/src mt-auto pt-5">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-md text-xs font-medium text-muted transition-colors duration-200 ease-fluid hover:text-text">
          <span className="group-open/src:hidden">
            {n} source episode{n === 1 ? "" : "s"}
          </span>
          <span className="hidden group-open/src:inline">Hide sources</span>
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden className="transition-transform duration-300 ease-fluid group-open/src:rotate-180">
            <path d="M2 3.5 L5 6.5 L8 3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </summary>
        <ul className="mt-3 space-y-3 border-t border-border pt-3">
          {item.episodes.map((e) => (
            <li key={e.episode_id} className="text-sm leading-snug">
              {e.url ? (
                <a
                  href={e.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-text-2 underline decoration-border-strong underline-offset-[3px] transition-colors duration-200 ease-fluid hover:text-text hover:decoration-current"
                >
                  {e.title}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              ) : (
                <span className="text-text-2">{e.title}</span>
              )}
              <span className="mt-1 block text-xs text-faint">
                {e.show_name} · {fmtDate(e.published_at)}
                {e.relationship ? ` · ${e.relationship.replace("_", " ")}` : ""}
              </span>
            </li>
          ))}
        </ul>
      </details>
    </Card>
  );
}
