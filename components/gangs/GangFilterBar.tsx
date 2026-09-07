"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { GANG_CATEGORIE_OPTIONS } from "@/lib/supabase/gangs-types";

const NIVEAUX = [
  { value: "", label: "Tous les niveaux" },
  { value: "faible", label: "Faible" },
  { value: "moyen", label: "Moyen" },
  { value: "eleve", label: "Élevé" },
];

const CATEGORIES = [
  { value: "", label: "Toutes les catégories" },
  ...GANG_CATEGORIE_OPTIONS,
];

export function GangFilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");

  function updateParams(next: {
    q?: string;
    niveau?: string;
    categorie?: string;
  }) {
    const params = new URLSearchParams(searchParams.toString());

    if (next.q !== undefined) {
      if (next.q) params.set("q", next.q);
      else params.delete("q");
    }
    if (next.niveau !== undefined) {
      if (next.niveau) params.set("niveau", next.niveau);
      else params.delete("niveau");
    }
    if (next.categorie !== undefined) {
      if (next.categorie) params.set("categorie", next.categorie);
      else params.delete("categorie");
    }

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="mt-6 flex flex-wrap gap-3">
      <input
        type="search"
        placeholder="Rechercher une fiche…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") updateParams({ q });
        }}
        onBlur={() => updateParams({ q })}
        className="min-w-[220px] flex-1 rounded border border-gtf-border bg-gtf-panel-alt px-3 py-2 text-sm text-gtf-text focus:border-gtf-blue focus:outline-none"
      />
      <select
        defaultValue={searchParams.get("categorie") ?? ""}
        onChange={(e) => updateParams({ categorie: e.target.value })}
        className="rounded border border-gtf-border bg-gtf-panel-alt px-3 py-2 text-sm text-gtf-text focus:border-gtf-blue focus:outline-none"
      >
        {CATEGORIES.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
      <select
        defaultValue={searchParams.get("niveau") ?? ""}
        onChange={(e) => updateParams({ niveau: e.target.value })}
        className="rounded border border-gtf-border bg-gtf-panel-alt px-3 py-2 text-sm text-gtf-text focus:border-gtf-blue focus:outline-none"
      >
        {NIVEAUX.map((n) => (
          <option key={n.value} value={n.value}>
            {n.label}
          </option>
        ))}
      </select>
    </div>
  );
}
