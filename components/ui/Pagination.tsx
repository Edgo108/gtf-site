import Link from "next/link";
import { pageCount } from "@/lib/pagination";
import { btn } from "@/lib/ui/styles";

// Navigation « Précédent / Suivant » en bas d'une liste paginée. Garde les
// autres paramètres de l'URL (recherche, filtres). Rien n'est affiché
// quand tout tient sur une page.
export function Pagination({
  page,
  total,
  basePath,
  params = {},
}: {
  page: number;
  total: number;
  basePath: string;
  params?: Record<string, string | undefined>;
}) {
  const pages = pageCount(total);
  if (pages <= 1) return null;

  const hrefFor = (target: number) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) search.set(key, value);
    }
    if (target > 1) search.set("page", String(target));
    const qs = search.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  const disabled = "pointer-events-none opacity-40";

  return (
    <nav
      aria-label="Pagination"
      className="mt-6 flex flex-wrap items-center justify-between gap-3"
    >
      <Link
        href={hrefFor(page - 1)}
        aria-disabled={page <= 1}
        tabIndex={page <= 1 ? -1 : undefined}
        className={btn("secondary", "sm", page <= 1 ? disabled : "")}
      >
        ← Précédent
      </Link>
      <span className="font-mono text-xs text-gtf-text-muted">
        Page {Math.min(page, pages)} / {pages} · {total} au total
      </span>
      <Link
        href={hrefFor(page + 1)}
        aria-disabled={page >= pages}
        tabIndex={page >= pages ? -1 : undefined}
        className={btn("secondary", "sm", page >= pages ? disabled : "")}
      >
        Suivant →
      </Link>
    </nav>
  );
}
