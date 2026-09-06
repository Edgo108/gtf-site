"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const STATUTS = [
  { value: "", label: "Tous les statuts" },
  { value: "en_cours", label: "En cours" },
  { value: "cloturee", label: "Clôturée" },
  { value: "archivee", label: "Archivée" },
];

export function SearchFilterBar({ resultCount }: { resultCount: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [, startTransition] = useTransition();

  const searchKey = searchParams.toString();
  const [lastKey, setLastKey] = useState(searchKey);
  const [toast, setToast] = useState<string | null>(null);

  // Pas d'effet : on dérive le toast directement pendant le rendu quand
  // les paramètres de recherche changent (pattern React recommandé pour
  // éviter un rendu supplémentaire déclenché depuis un effet).
  if (searchKey !== lastKey) {
    setLastKey(searchKey);

    const hasQuery = Boolean(
      searchParams.get("q") || searchParams.get("statut"),
    );

    if (hasQuery) {
      const label =
        resultCount > 1 ? "enquêtes correspondent" : "enquête correspond";
      setToast(`${resultCount} ${label} à votre recherche`);
    } else {
      setToast(null);
    }
  }

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  function updateParams(next: { q?: string; statut?: string }) {
    const params = new URLSearchParams(searchParams.toString());

    if (next.q !== undefined) {
      if (next.q) params.set("q", next.q);
      else params.delete("q");
    }
    if (next.statut !== undefined) {
      if (next.statut) params.set("statut", next.statut);
      else params.delete("statut");
    }

    startTransition(() => {
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
    });
  }

  return (
    <>
      {toast && (
        <div
          role="status"
          className="fixed right-4 top-4 z-50 w-72 rounded-md border border-gtf-blue bg-gtf-panel p-3 text-sm text-gtf-text shadow-lg"
        >
          <div className="flex items-start justify-between gap-2">
            <p>{toast}</p>
            <button
              onClick={() => setToast(null)}
              aria-label="Fermer"
              className="shrink-0 text-gtf-text-muted hover:text-gtf-text"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <input
          type="search"
          placeholder="Rechercher (titre, suspects, responsable)…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") updateParams({ q });
          }}
          onBlur={() => updateParams({ q })}
          className="min-w-[220px] flex-1 rounded border border-gtf-border bg-gtf-panel-alt px-3 py-2 text-sm text-gtf-text focus:border-gtf-blue focus:outline-none"
        />
        <select
          defaultValue={searchParams.get("statut") ?? ""}
          onChange={(e) => updateParams({ statut: e.target.value })}
          className="rounded border border-gtf-border bg-gtf-panel-alt px-3 py-2 text-sm text-gtf-text focus:border-gtf-blue focus:outline-none"
        >
          {STATUTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}
