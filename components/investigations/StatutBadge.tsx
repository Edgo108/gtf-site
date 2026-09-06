import { STATUT_LABELS } from "@/lib/investigations/change-summary";
import type { InvestigationStatut } from "@/lib/supabase/investigations-types";

const STYLES: Record<InvestigationStatut, string> = {
  en_cours: "border-gtf-blue text-gtf-blue-hover bg-gtf-blue/10",
  cloturee: "border-gtf-green text-gtf-green bg-gtf-green/10",
  archivee: "border-gtf-text-muted text-gtf-text-muted bg-gtf-panel-alt",
};

export function StatutBadge({ statut }: { statut: InvestigationStatut }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded border px-2 py-0.5 font-mono text-xs uppercase tracking-wider ${STYLES[statut]}`}
    >
      {STATUT_LABELS[statut]}
    </span>
  );
}
