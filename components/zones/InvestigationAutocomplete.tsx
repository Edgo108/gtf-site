"use client";

import { useEffect, useRef, useState } from "react";

// Recherche par titre parmi les enquêtes existantes, sélection
// obligatoire dans la liste (pas de texte libre) : tant qu'aucune
// suggestion n'a été cliquée, `value` (l'id retenu) reste vide, même si
// l'utilisateur a tapé du texte — évite qu'une faute de frappe casse le
// lien labo ↔ enquête.
export function InvestigationAutocomplete({
  investigations,
  value,
  onChange,
  inputClassName,
}: {
  investigations: { id: string; titre: string }[];
  value: string;
  onChange: (id: string) => void;
  inputClassName: string;
}) {
  const selected = investigations.find((i) => i.id === value) ?? null;
  const [query, setQuery] = useState(selected?.titre ?? "");
  const [open, setOpen] = useState(false);

  // Resynchronise le texte affiché quand la sélection change depuis
  // l'extérieur (ex: ouverture de l'édition d'un labo déjà lié) —
  // ajustement pendant le rendu plutôt qu'un effet, cf. règle ESLint
  // react-hooks/set-state-in-effect sur l'état dérivé.
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setQuery(selected?.titre ?? "");
  }

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
    ? investigations.filter((i) =>
        i.titre.toLowerCase().includes(normalizedQuery),
      )
    : investigations;

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          onChange("");
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setOpen(false);
          if (!value) setQuery("");
        }}
        placeholder="Rechercher une enquête par titre…"
        className={inputClassName}
      />
      {open && (
        <ul className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded border border-gtf-border bg-gtf-panel shadow-lg">
          {matches.length > 0 ? (
            matches.slice(0, 8).map((inv) => (
              <li key={inv.id}>
                <button
                  type="button"
                  // onMouseDown (avant le blur de l'input) plutôt que
                  // onClick : le blur fermerait la liste avant qu'un
                  // clic n'ait le temps de s'y déclencher.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onChange(inv.id);
                    setQuery(inv.titre);
                    setOpen(false);
                  }}
                  className="block w-full px-2 py-1.5 text-left text-xs text-gtf-text hover:bg-gtf-panel-alt"
                >
                  {inv.titre}
                </button>
              </li>
            ))
          ) : (
            <li className="px-2 py-1.5 text-xs text-gtf-text-muted">
              Aucune enquête trouvée.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
