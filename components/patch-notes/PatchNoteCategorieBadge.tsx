import {
  PATCH_NOTE_CATEGORIE_LABELS,
  type PatchNoteCategorie,
} from "@/lib/supabase/patch-notes-types";

// Distinction visuelle claire (palette tactique en place) :
//  - Nouveauté  → vert  (les ajouts)
//  - Amélioration → ambre
//  - Correction → rouge  (les corrections de bugs)
const STYLES: Record<PatchNoteCategorie, string> = {
  nouveaute: "border-gtf-green text-gtf-green bg-gtf-green/10",
  amelioration: "border-gtf-amber text-gtf-amber bg-gtf-amber/10",
  correction: "border-gtf-red text-gtf-red bg-gtf-red/10",
};

export function PatchNoteCategorieBadge({
  categorie,
}: {
  categorie: PatchNoteCategorie;
}) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded border px-2 py-0.5 font-mono text-xs uppercase tracking-wider ${
        STYLES[categorie] ?? STYLES.nouveaute
      }`}
    >
      {PATCH_NOTE_CATEGORIE_LABELS[categorie] ?? categorie}
    </span>
  );
}
