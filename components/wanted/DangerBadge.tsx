import type { NiveauDangerosite } from "@/lib/supabase/wanted-notices-types";

const STYLES: Record<NiveauDangerosite, string> = {
  faible: "border-gtf-green text-gtf-green bg-gtf-green/10",
  moyen: "border-gtf-amber text-gtf-amber bg-gtf-amber/10",
  eleve: "border-gtf-red text-gtf-red bg-gtf-red/10",
};

const LABELS: Record<NiveauDangerosite, string> = {
  faible: "Danger faible",
  moyen: "Danger moyen",
  eleve: "Danger élevé",
};

export function DangerBadge({ niveau }: { niveau: NiveauDangerosite }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded border px-2 py-0.5 font-mono text-xs uppercase tracking-wider ${STYLES[niveau]}`}
    >
      {LABELS[niveau]}
    </span>
  );
}
