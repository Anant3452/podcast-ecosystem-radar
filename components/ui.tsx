import type { ReactNode } from "react";

/** Small uppercase label used above headings. */
export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-muted ${className}`}>{children}</p>
  );
}

export function PageHeader({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <header className="animate-rise max-w-3xl">
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-[-0.03em] text-text sm:text-5xl">{title}</h1>
      {children && <div className="mt-4 text-[17px] leading-relaxed text-text-2">{children}</div>}
    </header>
  );
}

/** Translucent card whose hairline border brightens on hover. */
export function Card({
  children,
  className = "",
  interactive = false,
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-border bg-surface backdrop-blur-xl transition-[border-color,background-color,transform,box-shadow] duration-300 ease-fluid ${
        interactive ? "hover:-translate-y-0.5 hover:border-border-strong hover:bg-surface-hover hover:shadow-2xl hover:shadow-black/40" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function Pill({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border border-border px-2.5 py-0.5 text-[11px] text-text-2 ${className}`}>
      {children}
    </span>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-border px-6 py-10 text-center">
      <p className="font-medium text-text">{title}</p>
      {children && <div className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">{children}</div>}
    </div>
  );
}
