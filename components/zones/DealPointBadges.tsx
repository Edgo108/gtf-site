import {
  DEAL_PRODUIT_LABELS,
  DEAL_STATUT_LABELS,
  type DealProduit,
  type DealStatut,
} from "@/lib/supabase/deal-points-types";
import { BADGE_TONES, badgeBase } from "@/lib/ui/styles";

const PRODUIT_TONES: Record<DealProduit, keyof typeof BADGE_TONES> = {
  cocaine: "muted",
  meth: "blue",
  weed: "green",
};

export function DealProduitBadge({ produit }: { produit: DealProduit }) {
  return (
    <span className={`${badgeBase} ${BADGE_TONES[PRODUIT_TONES[produit]]}`}>
      {DEAL_PRODUIT_LABELS[produit]}
    </span>
  );
}

export function DealStatutBadge({ statut }: { statut: DealStatut }) {
  return (
    <span
      className={`${badgeBase} ${BADGE_TONES[statut === "actif" ? "green" : "red"]}`}
    >
      {DEAL_STATUT_LABELS[statut]}
    </span>
  );
}
