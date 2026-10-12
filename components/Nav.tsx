"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "This week" },
  { href: "/archive", label: "Archive" },
  { href: "/shows", label: "Shows" },
  { href: "/admin", label: "Admin" },
];

export function Nav() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  return (
    <nav aria-label="Primary" className="-mr-2 flex items-center gap-0.5 overflow-x-auto text-[13px]">
      {NAV.map((n) => {
        const active = isActive(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 transition-colors duration-200 ease-fluid ${
              active ? "bg-surface-strong text-text" : "text-muted hover:bg-surface hover:text-text"
            }`}
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
