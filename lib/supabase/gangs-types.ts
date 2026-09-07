export type NiveauMenace = "faible" | "moyen" | "eleve";
export type MembreStatut = "actif" | "arrete" | "recherche" | "decede";

// Catégorie d'une fiche « B.D.D » (table `gangs`). Étiquette seule : tous
// les autres champs restent communs aux 3 catégories.
export type GangCategorie = "Gang" | "MC" | "Orga";

// Source unique pour tout menu déroulant basé sur la catégorie (formulaire
// B.D.D, filtre, et futures fonctionnalités : ex. organisation liée à un
// marqueur laboratoire sur la carte).
export const GANG_CATEGORIES: readonly GangCategorie[] = ["Gang", "MC", "Orga"];

// Libellé court (badge, colonne de tableau).
export const GANG_CATEGORIE_LABELS: Record<GangCategorie, string> = {
  Gang: "Gang",
  MC: "MC",
  Orga: "Orga",
};

// Libellé complet (aide, description).
export const GANG_CATEGORIE_LABELS_LONG: Record<GangCategorie, string> = {
  Gang: "Gang",
  MC: "MC (Motorcycle Club)",
  Orga: "Orga (Organisation)",
};

// Options prêtes à l'emploi pour un <select>.
export const GANG_CATEGORIE_OPTIONS: { value: GangCategorie; label: string }[] =
  GANG_CATEGORIES.map((value) => ({
    value,
    label: GANG_CATEGORIE_LABELS_LONG[value],
  }));

export function isGangCategorie(value: unknown): value is GangCategorie {
  return (
    typeof value === "string" &&
    (GANG_CATEGORIES as readonly string[]).includes(value)
  );
}

export type Gang = {
  id: string;
  nom: string;
  categorie: GangCategorie;
  territoire: string;
  niveau_menace: NiveauMenace;
  activites: string;
  couleur: string;
  notes: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type GangMember = {
  id: string;
  gang_id: string;
  nom: string;
  role: string;
  statut: MembreStatut;
  created_at: string;
  updated_at: string;
};
