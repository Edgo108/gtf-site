import {
  LAB_CATEGORIE_LABELS,
  LAB_STATUT_LABELS,
  type LabMarker,
} from "@/lib/supabase/lab-markers-types";

type ComparableFields = Pick<
  LabMarker,
  "categorie" | "statut" | "organisation_id" | "position" | "investigation_id"
>;

export function buildLabMarkerChangeSummary(
  before: ComparableFields,
  after: ComparableFields,
): string {
  const changes: string[] = [];

  if (before.categorie !== after.categorie) {
    const label = after.categorie
      ? LAB_CATEGORIE_LABELS[after.categorie]
      : "Non déterminée";
    changes.push(`Catégorie changée en « ${label} »`);
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
  if (before.investigation_id !== after.investigation_id) {
    changes.push(
      after.investigation_id ? "Enquête liée modifiée" : "Enquête liée retirée",
    );
  }

  return changes.length > 0 ? changes.join(" · ") : "Aucun changement détecté";
}
