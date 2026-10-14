// Archives : Rapports d'intervention et Plaintes.

export type Rapport = {
  id: string;
  // Numéro officiel (null pour un test) / numéro de test (null sinon).
  numero: number | null;
  numero_test: number | null;
  // Document d'entraînement (« Mode test ») : figé à la création, sans
  // numéro officiel, sans pièces jointes, exclu des compteurs.
  est_test: boolean;
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
  // Numéro officiel (null pour un test) / numéro de test (null sinon).
  numero: number | null;
  numero_test: number | null;
  // Document d'entraînement (« Mode test ») : figé à la création, sans
  // numéro officiel, sans pièces jointes, exclu des compteurs.
  est_test: boolean;
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

type Numbered = Pick<Rapport, "numero" | "numero_test" | "est_test">;

// Référence affichée d'un rapport / d'une plainte : « #001 » pour un
// document officiel, « TEST-001 » pour un test. (Un futur export PDF
// s'appuiera sur `est_test` pour le filigrane « TEST ».)
export function archiveReference(doc: Numbered): string {
  return doc.est_test
    ? `TEST-${formatNumero(doc.numero_test ?? 0)}`
    : `#${formatNumero(doc.numero ?? 0)}`;
}

// Filtre des listes : Tous / Officiels / Tests (paramètre `type`).
export const ARCHIVE_TYPE_FILTERS = [
  { value: "", label: "Tous" },
  { value: "officiels", label: "Officiels" },
  { value: "tests", label: "Tests" },
] as const;

export type ArchiveTypeFilter = "" | "officiels" | "tests";

export function readArchiveTypeFilter(value?: string): ArchiveTypeFilter {
  return value === "officiels" || value === "tests" ? value : "";
}

export const TEST_MODE_EXPLANATION =
  "Ce document est un entraînement : il n'aura pas de numéro officiel ni de pièces jointes et ne sera pas comptabilisé.";
