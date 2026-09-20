export type NiveauDangerosite = "faible" | "moyen" | "eleve";
export type WantedStatut = "actif" | "capture";

export type WantedNotice = {
  id: string;
  nom_suspect: string;
  photo_url: string | null;
  description: string;
  niveau_dangerosite: NiveauDangerosite;
  statut: WantedStatut;
  organisation_gang_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};
