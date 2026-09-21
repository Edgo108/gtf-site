"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";
import { inputBase } from "@/lib/ui/styles";

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

  const toast = useToast();
  const searchKey = searchParams.toString();
  const lastToastKey = useRef(searchKey);

  // Confirmation du nombre de résultats quand la recherche change. Le
  // nombre et les paramètres arrivent ensemble (même navigation), la clé
  // de recherche évite un second toast si seul le décompte est rafraîchi.
  useEffect(() => {
    if (lastToastKey.current === searchKey) return;
    lastToastKey.current = searchKey;

    if (searchParams.get("q") || searchParams.get("statut")) {
      const label =
        resultCount > 1 ? "enquêtes correspondent" : "enquête correspond";
      toast.info(`${resultCount} ${label} à votre recherche`);
    }
  }, [searchKey, searchParams, resultCount, toast]);

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
          className={`min-w-[220px] flex-1 ${inputBase}`}
        />
        <select
          defaultValue={searchParams.get("statut") ?? ""}
          onChange={(e) => updateParams({ statut: e.target.value })}
          className={inputBase}
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
