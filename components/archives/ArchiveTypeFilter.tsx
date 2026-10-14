import Link from "next/link";
import {
  ARCHIVE_TYPE_FILTERS,
  type ArchiveTypeFilter as Filter,
} from "@/lib/supabase/archives-types";

// Filtre Tous / Officiels / Tests des listes de Rapports et Plaintes
// (simples liens : le filtrage est fait par la page serveur).
export function ArchiveTypeFilter({
  basePath,
  current,
}: {
  basePath: string;
  current: Filter;
}) {
  return (
    <nav
      aria-label="Type de document"
      className="inline-flex overflow-hidden rounded border border-gtf-border"
    >
      {ARCHIVE_TYPE_FILTERS.map((filter) => {
        const active = filter.value === current;
        return (
          <Link
            key={filter.value}
            href={filter.value ? `${basePath}?type=${filter.value}` : basePath}
            aria-current={active ? "page" : undefined}
            className={`px-3 py-2 font-mono text-xs uppercase tracking-wider transition-colors sm:py-1.5 ${
              active
                ? filter.value === "tests"
                  ? "bg-gtf-violet/15 text-gtf-violet"
                  : "bg-gtf-blue/15 text-gtf-blue-hover"
                : "text-gtf-text-muted hover:bg-gtf-panel-alt hover:text-gtf-text"
            }`}
          >
            {filter.label}
          </Link>
        );
      })}
    </nav>
  );
}
