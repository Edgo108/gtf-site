import {
  LAB_CATEGORIE_LABELS,
  LAB_STATUT_LABELS,
  type LabCategorie,
  type LabStatut,
} from "@/lib/supabase/lab-markers-types";

const badgeBase =
  "inline-block whitespace-nowrap rounded border px-2 py-0.5 font-mono text-xs uppercase tracking-wider";

const CATEGORIE_STYLES: Record<LabCategorie, string> = {
  arme: "border-gtf-blue text-gtf-blue-hover bg-gtf-blue/10",
  cocaine: "border-gtf-text-muted text-gtf-text bg-gtf-panel-alt",
  meth: "border-gtf-green text-gtf-green bg-gtf-green/10",
};

export function LabCategorieBadge({
  categorie,
}: {
  categorie: LabCategorie;
}) {
  return (
    <span className={`${badgeBase} ${CATEGORIE_STYLES[categorie] ?? CATEGORIE_STYLES.arme}`}>
      {LAB_CATEGORIE_LABELS[categorie] ?? categorie}
    </span>
  );
}

const STATUT_STYLES: Record<LabStatut, string> = {
  actif: "border-gtf-green text-gtf-green bg-gtf-green/10",
  raided: "border-gtf-red text-gtf-red bg-gtf-red/10",
};

export function LabStatutBadge({ statut }: { statut: LabStatut }) {
  return (
    <span className={`${badgeBase} ${STATUT_STYLES[statut] ?? STATUT_STYLES.actif}`}>
      {LAB_STATUT_LABELS[statut] ?? statut}
    </span>
  );
}
