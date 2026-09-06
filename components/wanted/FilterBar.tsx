"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

const STATUTS = [
  { value: "", label: "Tous les statuts" },
  { value: "actif", label: "Actif" },
  { value: "capture", label: "Capturé" },
];

const NIVEAUX = [
  { value: "", label: "Tous les niveaux" },
  { value: "faible", label: "Faible" },
  { value: "moyen", label: "Moyen" },
  { value: "eleve", label: "Élevé" },
];

const selectClass =
  "rounded border border-gtf-border bg-gtf-panel-alt px-3 py-2 text-sm text-gtf-text focus:border-gtf-blue focus:outline-none";

export function FilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function update(next: { statut?: string; niveau?: string }) {
    const params = new URLSearchParams(searchParams.toString());

    if (next.statut !== undefined) {
      if (next.statut) params.set("statut", next.statut);
      else params.delete("statut");
    }
    if (next.niveau !== undefined) {
      if (next.niveau) params.set("niveau", next.niveau);
      else params.delete("niveau");
    }

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="mt-6 flex flex-wrap gap-3">
      <select
        defaultValue={searchParams.get("statut") ?? ""}
        onChange={(e) => update({ statut: e.target.value })}
        className={selectClass}
      >
        {STATUTS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      <select
        defaultValue={searchParams.get("niveau") ?? ""}
        onChange={(e) => update({ niveau: e.target.value })}
        className={selectClass}
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
