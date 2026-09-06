import type { MembreStatut } from "@/lib/supabase/gangs-types";

const STYLES: Record<MembreStatut, string> = {
  actif: "border-gtf-amber text-gtf-amber bg-gtf-amber/10",
  recherche: "border-gtf-red text-gtf-red bg-gtf-red/10",
  arrete: "border-gtf-green text-gtf-green bg-gtf-green/10",
  decede: "border-gtf-text-muted text-gtf-text-muted bg-gtf-panel-alt",
};

const LABELS: Record<MembreStatut, string> = {
  actif: "Actif",
  recherche: "Recherché",
  arrete: "Arrêté",
  decede: "Décédé",
};

export function MemberStatutBadge({ statut }: { statut: MembreStatut }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded border px-2 py-0.5 font-mono text-xs uppercase tracking-wider ${STYLES[statut]}`}
    >
      {LABELS[statut]}
    </span>
  );
}
