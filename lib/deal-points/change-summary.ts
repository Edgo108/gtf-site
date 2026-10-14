import {
  DEAL_PRODUIT_LABELS,
  DEAL_STATUT_LABELS,
  type DealPoint,
} from "@/lib/supabase/deal-points-types";

type ComparableFields = Pick<
  DealPoint,
  "produit" | "statut" | "organisation_id" | "note" | "position"
>;

export function buildDealPointChangeSummary(
  before: ComparableFields,
  after: ComparableFields,
): string {
  const changes: string[] = [];

  if (before.produit !== after.produit) {
    changes.push(`Produit changé en « ${DEAL_PRODUIT_LABELS[after.produit]} »`);
  }
  if (before.statut !== after.statut) {
    changes.push(`Statut changé en « ${DEAL_STATUT_LABELS[after.statut]} »`);
  }
  if (before.organisation_id !== after.organisation_id) {
    changes.push(
      after.organisation_id
        ? "Organisation associée modifiée"
        : "Organisation retirée",
    );
  }
  if ((before.note ?? "") !== (after.note ?? "")) {
    changes.push("Note modifiée");
  }
  if (JSON.stringify(before.position) !== JSON.stringify(after.position)) {
    changes.push("Point repositionné");
  }

  return changes.length > 0 ? changes.join(" · ") : "Aucun changement détecté";
}
