// Marqueurs « Laboratoire » de la carte interactive (table `lab_markers`).

export type LabCategorie = "arme" | "cocaine" | "meth";
export type LabStatut = "actif" | "raided";

export const LAB_CATEGORIES: readonly LabCategorie[] = [
  "arme",
  "cocaine",
  "meth",
];

export const LAB_CATEGORIE_LABELS: Record<LabCategorie, string> = {
  arme: "Arme",
  cocaine: "Cocaïne",
  meth: "Meth",
};

export const LAB_CATEGORIE_OPTIONS: { value: LabCategorie; label: string }[] =
  LAB_CATEGORIES.map((value) => ({
    value,
    label: LAB_CATEGORIE_LABELS[value],
  }));

// Chemin de l'icône affichée sur la carte (fichiers fournis par l'admin
// dans public/markers/ — voir public/markers/README.md).
export function labMarkerIconUrl(categorie: LabCategorie): string {
  return `/markers/${categorie}.png`;
}

export const LAB_STATUTS: readonly LabStatut[] = ["actif", "raided"];

export const LAB_STATUT_LABELS: Record<LabStatut, string> = {
  actif: "Actif",
  raided: "Raid effectué",
};

export const LAB_STATUT_OPTIONS: { value: LabStatut; label: string }[] =
  LAB_STATUTS.map((value) => ({ value, label: LAB_STATUT_LABELS[value] }));

export function isLabCategorie(value: unknown): value is LabCategorie {
  return (
    typeof value === "string" &&
    (LAB_CATEGORIES as readonly string[]).includes(value)
  );
}

export function isLabStatut(value: unknown): value is LabStatut {
  return value === "actif" || value === "raided";
}

export type LabMarkerPosition = { x: number; y: number };

export type LabMarker = {
  id: string;
  categorie: LabCategorie;
  statut: LabStatut;
  organisation_id: string;
  position: LabMarkerPosition;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type LabMarkerHistoryEntry = {
  id: string;
  marker_id: string;
  agent_id: string | null;
  agent_pseudo: string;
  resume: string;
  created_at: string;
};

export type LabMarkerLock = {
  marker_id: string;
  locked_by: string;
  locked_at: string;
};

// Même durée que pour les zones sensibles.
export { LOCK_DURATION_MS } from "@/lib/supabase/zones-types";
