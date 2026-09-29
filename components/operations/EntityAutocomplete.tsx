"use client";

import { useEffect, useRef, useState } from "react";
import { fieldClass } from "@/lib/ui/styles";

// Recherche par libellé parmi une liste d'éléments déjà exclue des
// éléments déjà liés/ajoutés par l'appelant — sélection obligatoire dans
// la liste (pas de texte libre) : sélectionner un élément déclenche
// immédiatement `onSelect`, le champ se vide ensuite. Calqué sur
// components/zones/InvestigationAutocomplete.tsx (lien labo ↔ enquête).
export function EntityAutocomplete({
  items,
  onSelect,
  placeholder,
  disabled,
}: {
  items: { id: string; label: string }[];
  onSelect: (id: string) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const normalizedQuery = query.trim().toLowerCase();
  const matches = normalizedQuery
    ? items.filter((i) => i.label.toLowerCase().includes(normalizedQuery))
    : items;

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={query}
        disabled={disabled}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className={fieldClass}
      />
      {open && (
        <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded border border-gtf-border bg-gtf-panel shadow-lg">
          {matches.length > 0 ? (
            matches.slice(0, 8).map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  // onMouseDown (avant le blur de l'input) plutôt que
                  // onClick : le blur fermerait la liste avant qu'un clic
                  // n'ait le temps de s'y déclencher.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onSelect(item.id);
                    setQuery("");
                    setOpen(false);
                  }}
                  className="block w-full px-2 py-1.5 text-left text-xs text-gtf-text hover:bg-gtf-panel-alt"
                >
                  {item.label}
                </button>
              </li>
            ))
          ) : (
            <li className="px-2 py-1.5 text-xs text-gtf-text-muted">
              Aucun résultat.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
