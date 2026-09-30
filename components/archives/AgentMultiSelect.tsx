"use client";

import { useEffect, useRef, useState } from "react";
import type { AgentOption } from "@/lib/supabase/archives-types";
import { fieldClass } from "@/lib/ui/styles";

// Liste déroulante à sélection multiple d'agents (aucune saisie libre) :
// cases à cocher dans un menu, sélection rappelée sous forme de
// pastilles. Chaque agent coché est envoyé dans un champ caché `name`
// (répété), lu côté serveur avec formData.getAll().
export function AgentMultiSelect({
  id,
  name,
  agents,
  defaultValue = [],
}: {
  id?: string;
  name: string;
  agents: AgentOption[];
  defaultValue?: string[];
}) {
  const [selected, setSelected] = useState<string[]>(defaultValue);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Fermeture au clic en dehors / touche Échap (abonnement à des
  // événements du document : l'état n'est modifié que dans les callbacks).
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const pseudoById = new Map(agents.map((a) => [a.id, a.pseudo]));

  function toggle(agentId: string) {
    setSelected((current) =>
      current.includes(agentId)
        ? current.filter((x) => x !== agentId)
        : [...current, agentId],
    );
  }

  return (
    <div ref={rootRef} className="relative">
      {selected.map((agentId) => (
        <input key={agentId} type="hidden" name={name} value={agentId} />
      ))}

      <button
        id={id}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`${fieldClass} flex items-center justify-between gap-2 text-left`}
      >
        <span className={selected.length ? "" : "text-gtf-text-muted"}>
          {selected.length
            ? `${selected.length} agent${selected.length > 1 ? "s" : ""} sélectionné${selected.length > 1 ? "s" : ""}`
            : "Sélectionner des agents…"}
        </span>
        <span aria-hidden="true" className="text-xs text-gtf-text-muted">
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open && (
        <ul
          role="listbox"
          aria-multiselectable="true"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded border border-gtf-border bg-gtf-panel-alt py-1 shadow-lg"
        >
          {agents.length === 0 && (
            <li className="px-3 py-2 text-sm text-gtf-text-muted">
              Aucun agent disponible.
            </li>
          )}
          {agents.map((agent) => {
            const checked = selected.includes(agent.id);
            return (
              <li key={agent.id} role="option" aria-selected={checked}>
                <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-gtf-panel">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(agent.id)}
                    className="accent-gtf-blue"
                  />
                  {agent.pseudo}
                </label>
              </li>
            );
          })}
        </ul>
      )}

      {selected.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {selected.map((agentId) => (
            <span
              key={agentId}
              className="inline-flex items-center gap-1 rounded border border-gtf-blue bg-gtf-blue/10 px-2 py-0.5 font-mono text-xs text-gtf-blue-hover"
            >
              {pseudoById.get(agentId) ?? "Agent inconnu"}
              <button
                type="button"
                onClick={() => toggle(agentId)}
                aria-label={`Retirer ${pseudoById.get(agentId) ?? "cet agent"}`}
                className="text-gtf-text-muted hover:text-gtf-text"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
