// Points de deal de la carte interactive (table `deal_points`).

export type DealProduit = "cocaine" | "meth" | "weed";
export type DealStatut = "actif" | "inactif";

const DEAL_PRODUITS: readonly DealProduit[] = ["cocaine", "meth", "weed"];
const DEAL_STATUTS: readonly DealStatut[] = ["actif", "inactif"];

export const DEAL_PRODUIT_LABELS: Record<DealProduit, string> = {
  cocaine: "Cocaïne",
  meth: "Meth",
  weed: "Weed",
};

export const DEAL_STATUT_LABELS: Record<DealStatut, string> = {
  actif: "Actif",
  inactif: "Inactif",
};

export const DEAL_PRODUIT_OPTIONS = DEAL_PRODUITS.map((value) => ({
  value,
  label: DEAL_PRODUIT_LABELS[value],
}));

export const DEAL_STATUT_OPTIONS = DEAL_STATUTS.map((value) => ({
  value,
  label: DEAL_STATUT_LABELS[value],
}));

export function isDealProduit(value: unknown): value is DealProduit {
  return (
    typeof value === "string" &&
    (DEAL_PRODUITS as readonly string[]).includes(value)
  );
}

export function isDealStatut(value: unknown): value is DealStatut {
  return value === "actif" || value === "inactif";
}

export type DealPointPosition = { x: number; y: number };

export type DealPoint = {
  id: string;
  produit: DealProduit;
  statut: DealStatut;
  // Organisation (B.D.D.) facultative.
  organisation_id: string | null;
  note: string | null;
  position: DealPointPosition;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type DealPointHistoryEntry = {
  id: string;
  point_id: string;
  agent_id: string | null;
  agent_pseudo: string;
  resume: string;
  created_at: string;
};

// Gris neutre d'un point (ou d'une zone de vente) sans organisation.
export const NO_ORGANISATION_COLOR = "#8B94A0";
