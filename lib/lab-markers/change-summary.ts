import {
  LAB_CATEGORIE_LABELS,
  LAB_STATUT_LABELS,
  type LabMarker,
} from "@/lib/supabase/lab-markers-types";

type ComparableFields = Pick<
  LabMarker,
  "categorie" | "statut" | "organisation_id" | "position"
>;

export function buildLabMarkerChangeSummary(
  before: ComparableFields,
  after: ComparableFields,
): string {
  const changes: string[] = [];

  if (before.categorie !== after.categorie) {
    changes.push(
      `Catégorie changée en « ${LAB_CATEGORIE_LABELS[after.categorie]} »`,
    );
  }
  if (before.statut !== after.statut) {
    changes.push(`Statut changé en « ${LAB_STATUT_LABELS[after.statut]} »`);
  }
  if (before.organisation_id !== after.organisation_id) {
    changes.push("Organisation associée modifiée");
  }
  if (JSON.stringify(before.position) !== JSON.stringify(after.position)) {
    changes.push("Marqueur repositionné");
  }

  return changes.length > 0 ? changes.join(" · ") : "Aucun changement détecté";
}
