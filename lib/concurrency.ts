// Contrôle de version « optimiste » des formulaires de modification : le
// formulaire renvoie la date `updated_at` de la fiche telle qu'elle était
// à son ouverture ; l'enregistrement n'est accepté que si la fiche n'a
// pas changé depuis (filtre `.eq("updated_at", …)` sur l'UPDATE). Sinon,
// rien n'est écrasé et l'agent est invité à recharger.
//
// Pas de verrou : deux agents peuvent ouvrir la même fiche, seul le
// premier qui enregistre passe, le second est prévenu au lieu d'écraser
// silencieusement le travail de l'autre.

export const VERSION_FIELD = "expected_updated_at";

export const STALE_EDIT_ERROR =
  "Cette fiche a été modifiée par un autre agent depuis l'ouverture du formulaire. Vos changements n'ont PAS été enregistrés : rechargez la page pour voir la version à jour, puis refaites vos modifications.";

export function readExpectedVersion(formData: FormData): string | null {
  const value = String(formData.get(VERSION_FIELD) ?? "").trim();
  return value || null;
}

// Compare deux horodatages de la base (formats texte éventuellement
// différents) : même instant = même version.
export function isSameVersion(a: string, b: string): boolean {
  return new Date(a).getTime() === new Date(b).getTime();
}
