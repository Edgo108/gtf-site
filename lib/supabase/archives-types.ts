// Archives : Rapports d'intervention et Plaintes.

export type Rapport = {
  id: string;
  numero: number;
  date_redaction: string;
  date_intervention: string | null;
  agent_redacteur_id: string;
  agents_lies: string[];
  nom_suspect: string;
  date_lecture_miranda: string | null;
  descriptif_situation: string;
  signature_agent_redacteur: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type Plainte = {
  id: string;
  numero: number;
  date_redaction: string;
  date_faits: string | null;
  nom_victime: string;
  agent_redacteur_id: string;
  descriptif_plainte: string;
  signature_victime: string | null;
  signature_agent_assermente: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

// Agent proposé dans les listes déroulantes « Agent rédacteur » /
// « Agents liés » (résolu côté serveur : la RLS de profiles ne laisse lire
// que sa propre ligne).
export type AgentOption = { id: string; pseudo: string };

// 1 → « 001 », 42 → « 042 », 1234 → « 1234 ».
export function formatNumero(numero: number): string {
  return String(numero).padStart(3, "0");
}
