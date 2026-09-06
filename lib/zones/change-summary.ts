import type { SensitiveZone } from "@/lib/supabase/zones-types";

const TYPE_LABELS = { vente: "Vente", influence: "Influence" } as const;

type ComparableFields = Pick<SensitiveZone, "gang_id" | "type_zone" | "points">;

export function buildZoneChangeSummary(
  before: ComparableFields,
  after: ComparableFields,
): string {
  const changes: string[] = [];

  if (before.gang_id !== after.gang_id) {
    changes.push("Gang associé modifié");
  }
  if (before.type_zone !== after.type_zone) {
    changes.push(
      `Type changé en « ${TYPE_LABELS[after.type_zone]} »`,
    );
  }
  if (JSON.stringify(before.points) !== JSON.stringify(after.points)) {
    changes.push("Contour de la zone modifié");
  }

  return changes.length > 0 ? changes.join(" · ") : "Aucun changement détecté";
}
