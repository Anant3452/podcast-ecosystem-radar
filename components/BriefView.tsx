import { SECTION_META, type BriefContent, type BriefItem, type SectionKey } from "@/lib/brief";

const STYLE: Record<SectionKey, { text: string; soft: string; border: string; dot: string; num: string }> = {
  guests: { text: "text-guests", soft: "bg-guests-soft", border: "border-l-guests", dot: "bg-guests", num: "01" },
  topics: { text: "text-topics", soft: "bg-topics-soft", border: "border-l-topics", dot: "bg-topics", num: "02" },
  sponsors: { text: "text-sponsors", soft: "bg-sponsors-soft", border: "border-l-sponsors", dot: "bg-sponsors", num: "03" },
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

export function BriefView({ brief, emailedAt }: { brief: BriefContent; emailedAt?: Date | null }) {
  const keys: SectionKey[] = ["guests", "topics", "sponsors"];
  return (
    <article>
      <section className="radar-rings -mx-4 rounded-none px-4 pb-10 sm:mx-0 sm:rounded-3xl sm:border sm:border-line sm:bg-card sm:p-10">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">
          Week of {new Date(brief.week_of).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
          {emailedAt ? " · emailed" : ""}
        </p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-5xl">This week in one line</h1>
        <p className="mt-5 max-w-3xl text-lg leading-relaxed text-ink-2 sm:text-xl">{brief.headline}</p>
        <dl className="mt-8 grid max-w-2xl grid-cols-3 gap-3">
          {keys.map((k) => (
            <a
              key={k}
              href={`#${k}`}
              className="rounded-2xl border border-line bg-paper px-4 py-3 transition hover:-translate-y-0.5 hover:shadow-sm"
            >
              <dt className={`text-[11px] font-medium uppercase tracking-wider ${STYLE[k].text}`}>{k}</dt>
              <dd className="mt-1 font-display text-3xl font-semibold">{brief.sections[k].length}</dd>
            </a>
          ))}
        </dl>
        <p className="mt-6 text-xs text-muted">
          {brief.stats.episodes_considered} episodes from {brief.stats.shows_with_episodes} shows · guests over{" "}
          {brief.windows.guest.days} days, topics over {brief.windows.topic.days} days, sponsors over{" "}
          {brief.windows.brand.days} days
          {brief.generated_by === "fallback" ? " · written by deterministic fallback (Gemini unavailable)" : ""}
        </p>
      </section>

      {keys.map((k) => (
        <Section key={k} sectionKey={k} items={brief.sections[k]} />
      ))}
    </article>
  );
}

function Section({ sectionKey, items }: { sectionKey: SectionKey; items: BriefItem[] }) {
  const meta = SECTION_META[sectionKey];
  const s = STYLE[sectionKey];
  return (
    <section id={sectionKey} className="mt-14 scroll-mt-6">
      <div className="flex items-baseline gap-4 border-b border-line pb-3">
        <span className={`font-mono text-sm ${s.text}`}>{s.num}</span>
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{meta.label}</h2>
          <p className="mt-1 text-sm text-muted">{meta.question}</p>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-line px-5 py-6 text-ink-2">{meta.empty}</p>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {items.map((it) => (
            <ItemCard key={it.ref} item={it} s={s} />
          ))}
        </div>
      )}
    </section>
  );
}

function ItemCard({ item, s }: { item: BriefItem; s: (typeof STYLE)[SectionKey] }) {
  return (
    <div className={`flex flex-col rounded-2xl border border-line border-l-4 ${s.border} bg-card p-5 shadow-[0_1px_0_rgba(0,0,0,0.03)]`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="font-display text-xl font-semibold leading-snug">{item.title}</h3>
        {item.meta && <span className="text-xs text-muted">{item.meta}</span>}
      </div>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{item.insight}</p>
      <p className={`mt-3 rounded-xl ${s.soft} px-3.5 py-2.5 text-sm leading-relaxed`}>
        <span className={`font-semibold ${s.text}`}>Action · </span>
        {item.action}
      </p>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {item.shows.map((sh) => (
          <span key={sh.show_id} className="rounded-full border border-line px-2.5 py-0.5 text-xs text-ink-2">
            {sh.show_name}
          </span>
        ))}
      </div>
      <details className="group mt-3 text-sm">
        <summary className="cursor-pointer list-none text-xs font-medium text-muted hover:text-ink">
          <span className="group-open:hidden">Show {item.episodes.length} source episode{item.episodes.length === 1 ? "" : "s"} ↓</span>
          <span className="hidden group-open:inline">Hide sources ↑</span>
        </summary>
        <ul className="mt-2 space-y-2">
          {item.episodes.map((e) => (
            <li key={e.episode_id} className="flex gap-2 leading-snug">
              <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${s.dot}`} />
              <span>
                {e.url ? (
                  <a href={e.url} target="_blank" rel="noreferrer" className="underline decoration-line underline-offset-2 hover:decoration-current">
                    {e.title}
                  </a>
                ) : (
                  e.title
                )}
                <span className="block text-xs text-muted">
                  {e.show_name} · {fmtDate(e.published_at)}
                  {e.relationship ? ` · ${e.relationship.replace("_", " ")}` : ""}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
