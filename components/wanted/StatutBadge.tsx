import type { WantedStatut } from "@/lib/supabase/wanted-notices-types";

const STYLES: Record<WantedStatut, string> = {
  actif: "border-gtf-red text-gtf-red bg-gtf-red/10",
  capture: "border-gtf-green text-gtf-green bg-gtf-green/10",
};

const LABELS: Record<WantedStatut, string> = {
  actif: "Actif",
  capture: "Capturé",
};

export function StatutBadge({ statut }: { statut: WantedStatut }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded border px-2 py-0.5 font-mono text-xs uppercase tracking-wider ${STYLES[statut]}`}
    >
      {LABELS[statut]}
    </span>
  );
}
