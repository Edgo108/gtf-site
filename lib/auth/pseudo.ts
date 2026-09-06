// Supabase Auth exige un email pour chaque compte. Comme le GTF fonctionne
// par pseudo (pas d'email réel demandé aux agents), on dérive un email
// interne déterministe à partir du pseudo — jamais affiché, jamais utilisé
// pour envoyer de vrais emails.
const INTERNAL_EMAIL_DOMAIN = "gtf.local";
const DIACRITICS_REGEX = new RegExp("[\\u0300-\\u036f]", "g");

export function slugifyPseudo(pseudo: string): string {
  return pseudo
    .normalize("NFD")
    .replace(DIACRITICS_REGEX, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "");
}

export function pseudoToEmail(pseudo: string): string {
  return `${slugifyPseudo(pseudo)}@${INTERNAL_EMAIL_DOMAIN}`;
}
