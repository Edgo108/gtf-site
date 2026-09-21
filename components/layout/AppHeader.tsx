"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/actions/auth";
import { NavBadge } from "@/components/ui/NavBadge";
import { btn } from "@/lib/ui/styles";

export type NavLink = {
  href: string;
  label: string;
  badge?: number;
};

// Barre de navigation principale. Sous `xl` (tablette / mobile) les liens
// passent dans un menu hamburger déroulant, qui se referme tout seul à
// chaque changement de page.
export function AppHeader({
  links,
  pseudo,
  grade,
}: {
  links: NavLink[];
  pseudo?: string;
  grade?: string;
}) {
  const pathname = usePathname();
  // Le menu est "ouvert pour cette page" : dès que le chemin change, il est
  // considéré fermé, sans effet ni état à resynchroniser.
  const [openFor, setOpenFor] = useState<string | null>(null);
  const open = openFor === pathname;

  const linkClass = (href: string) =>
    `relative transition-colors hover:text-gtf-text ${
      pathname === href || pathname.startsWith(`${href}/`)
        ? "text-gtf-text"
        : ""
    }`;

  const logout = (
    <form action={signOut}>
      <button
        type="submit"
        className={btn(
          "secondary",
          "sm",
          "font-mono hover:border-gtf-red! hover:text-gtf-red!",
        )}
      >
        Déconnexion
      </button>
    </form>
  );

  return (
    <header className="border-b border-gtf-border bg-gtf-panel">
      <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-8">
          <Link
            href="/dashboard"
            className="font-display text-sm font-bold uppercase tracking-widest text-gtf-text"
          >
            Gang Task Force
          </Link>
          <nav
            aria-label="Navigation principale"
            className="hidden items-center gap-5 font-mono text-xs uppercase tracking-wider text-gtf-text-muted xl:flex"
          >
            {links.map((link) => (
              <Link key={link.href} href={link.href} className={linkClass(link.href)}>
                {link.label}
                <NavBadge count={link.badge ?? 0} />
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          {pseudo && (
            <span className="hidden font-mono text-xs text-gtf-text-muted sm:inline">
              {pseudo} · {grade}
            </span>
          )}
          <div className="hidden xl:block">{logout}</div>
          <button
            type="button"
            onClick={() => setOpenFor(open ? null : pathname)}
            aria-expanded={open}
            aria-controls="menu-mobile"
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
            className={btn("secondary", "sm", "relative xl:hidden")}
          >
            <span aria-hidden="true" className="text-base leading-none">
              {open ? "✕" : "☰"}
            </span>
            Menu
            {!open && links.some((l) => (l.badge ?? 0) > 0) && (
              <span
                aria-hidden="true"
                className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-gtf-red"
              />
            )}
          </button>
        </div>
      </div>

      {open && (
        <div
          id="menu-mobile"
          className="border-t border-gtf-border px-4 pb-4 sm:px-6 xl:hidden"
        >
          <nav
            aria-label="Navigation principale"
            className="flex flex-col font-mono text-sm uppercase tracking-wider text-gtf-text-muted"
          >
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center justify-between border-b border-gtf-border py-3 transition-colors hover:text-gtf-text ${
                  pathname === link.href || pathname.startsWith(`${link.href}/`)
                    ? "text-gtf-text"
                    : ""
                }`}
              >
                {link.label}
                {(link.badge ?? 0) > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gtf-red px-1.5 font-mono text-[10px] font-bold leading-none text-gtf-text">
                    {(link.badge ?? 0) > 9 ? "9+" : link.badge}
                  </span>
                )}
              </Link>
            ))}
          </nav>
          <div className="mt-4 flex items-center justify-between gap-3">
            {pseudo && (
              <span className="font-mono text-xs text-gtf-text-muted sm:hidden">
                {pseudo} · {grade}
              </span>
            )}
            <div className="ml-auto">{logout}</div>
          </div>
        </div>
      )}
    </header>
  );
}
