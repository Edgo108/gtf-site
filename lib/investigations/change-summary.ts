import { normalizeName, parseSuspectNames } from "@/lib/investigations/suspects";
import type { Investigation } from "@/lib/supabase/investigations-types";

export const STATUT_LABELS: Record<Investigation["statut"], string> = {
  en_cours: "En cours",
  cloturee: "Clôturée",
  archivee: "Archivée",
};

function truncate(value: string, max = 40): string {
  const trimmed = value.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}

// Compare les listes de suspects (texte libre) et distingue ajout,
// retrait, et remplacement (un nom retiré + un nom ajouté = renommage).
function buildSuspectChanges(before: string, after: string): string[] {
  const beforeNames = parseSuspectNames(before);
  const afterNames = parseSuspectNames(after);

  const beforeKeys = new Set(beforeNames.map(normalizeName));
  const afterKeys = new Set(afterNames.map(normalizeName));

  const removed = beforeNames.filter((n) => !afterKeys.has(normalizeName(n)));
  const added = afterNames.filter((n) => !beforeKeys.has(normalizeName(n)));

  if (removed.length === 1 && added.length === 1) {
    return [`Suspect modifié : « ${removed[0]} » → « ${added[0]} »`];
  }

  const changes: string[] = [];
  for (const name of added) {
    changes.push(`Suspect ajouté : « ${name} »`);
  }
  for (const name of removed) {
    changes.push(`Suspect retiré : « ${name} »`);
  }
  return changes;
}

type ComparableFields = Pick<
  Investigation,
  | "titre"
  | "statut"
  | "suspects"
  | "preuves"
  | "description"
  | "agent_responsable"
>;

export function buildChangeSummary(
  before: ComparableFields,
  after: ComparableFields,
): string {
  const changes: string[] = [];

  if (before.statut !== after.statut) {
    changes.push(
      `Statut changé de « ${STATUT_LABELS[before.statut]} » à « ${STATUT_LABELS[after.statut]} »`,
    );
  }
  if (before.titre !== after.titre) {
    changes.push(
      `Titre changé de « ${truncate(before.titre)} » à « ${truncate(after.titre)} »`,
    );
  }
  if (before.agent_responsable !== after.agent_responsable) {
    changes.push(
      `Agent responsable changé de « ${truncate(before.agent_responsable) || "—"} » à « ${truncate(after.agent_responsable) || "—"} »`,
    );
  }
  if (before.suspects !== after.suspects) {
    changes.push(...buildSuspectChanges(before.suspects, after.suspects));
  }
  if (before.preuves !== after.preuves) {
    changes.push("Preuves modifiées");
  }
  if (before.description !== after.description) {
    changes.push("Description modifiée");
  }

  return changes.length > 0 ? changes.join(" · ") : "Aucun changement détecté";
}
