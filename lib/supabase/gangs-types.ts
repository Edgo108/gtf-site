export type NiveauMenace = "faible" | "moyen" | "eleve";
export type MembreStatut = "actif" | "arrete" | "recherche" | "decede";

export type Gang = {
  id: string;
  nom: string;
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
