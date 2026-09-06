export type InvestigationStatut = "en_cours" | "cloturee" | "archivee";

export type Investigation = {
  id: string;
  titre: string;
  statut: InvestigationStatut;
  suspects: string;
  preuves: string;
  description: string;
  agent_responsable: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type InvestigationHistoryEntry = {
  id: string;
  investigation_id: string;
  agent_id: string | null;
  agent_pseudo: string;
  resume: string;
  created_at: string;
};
