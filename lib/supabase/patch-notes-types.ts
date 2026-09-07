// Journal des mises à jour du site (« Patch notes »).

export type PatchNoteCategorie = "nouveaute" | "correction" | "amelioration";

// Ordre d'affichage dans les filtres / sélecteurs.
export const PATCH_NOTE_CATEGORIES: readonly PatchNoteCategorie[] = [
  "nouveaute",
  "amelioration",
  "correction",
];

export const PATCH_NOTE_CATEGORIE_LABELS: Record<PatchNoteCategorie, string> = {
  nouveaute: "Nouveauté",
  amelioration: "Amélioration",
  correction: "Correction",
};

export const PATCH_NOTE_CATEGORIE_OPTIONS: {
  value: PatchNoteCategorie;
  label: string;
}[] = PATCH_NOTE_CATEGORIES.map((value) => ({
  value,
  label: PATCH_NOTE_CATEGORIE_LABELS[value],
}));

export function isPatchNoteCategorie(
  value: unknown,
): value is PatchNoteCategorie {
  return (
    typeof value === "string" &&
    (PATCH_NOTE_CATEGORIES as readonly string[]).includes(value)
  );
}

export type PatchNote = {
  id: string;
  titre: string;
  description: string;
  categorie: PatchNoteCategorie;
  date: string; // "YYYY-MM-DD"
  created_by: string | null;
  created_at: string;
};

// Format court FR sans dépendre du fuseau (le champ `date` est une date
// nue "YYYY-MM-DD", `new Date("YYYY-MM-DD")` la lit en UTC et peut
// décaler d'un jour).
export function formatPatchDate(date: string): string {
  const [y, m, d] = date.split("-");
  return y && m && d ? `${d}/${m}/${y}` : date;
}

// Date du jour au format "YYYY-MM-DD" (à appeler côté serveur — jamais
// dans le corps de rendu d'un composant client, cf. react-hooks/purity).
export function todayISODate(): string {
  return new Date().toISOString().slice(0, 10);
}
