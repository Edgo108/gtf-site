// Longueurs maximales des champs texte (nombre de caractères). Source
// unique : le serveur les vérifie pour afficher un message clair, et la
// base les impose aussi (contraintes CHECK de supabase/text_limits.sql,
// générées depuis cette table — les garder alignées).

export const TEXT_LIMITS = {
  investigations: {
    titre: 150,
    suspects: 2000,
    preuves: 10000,
    description: 10000,
    agent_responsable: 120,
    casier_numero: 50,
    casier_code_acces: 50,
  },
  gangs: { nom: 120, territoire: 500, activites: 5000, notes: 10000 },
  gang_members: { nom: 120, role: 120 },
  wanted_notices: { nom_suspect: 120, description: 10000 },
  announcements: { titre: 150, message: 5000 },
  operations: { titre: 150, description: 10000 },
  patch_notes: { titre: 150, description: 5000 },
  rapports: { nom_suspect: 120, faits_reproches: 10000, descriptif_situation: 20000 },
  plaintes: { nom_victime: 120, descriptif_plainte: 20000 },
} as const;

const FIELD_LABELS: Record<string, string> = {
  titre: "Titre",
  suspects: "Suspects",
  preuves: "Preuves",
  description: "Description",
  agent_responsable: "Agent responsable",
  casier_numero: "Numéro de casier",
  casier_code_acces: "Code d'accès",
  nom: "Nom",
  territoire: "Territoire",
  activites: "Activités",
  notes: "Notes",
  role: "Rôle",
  nom_suspect: "Nom du suspect",
  message: "Message",
  faits_reproches: "Faits reprochés",
  descriptif_situation: "Descriptif de la situation",
  nom_victime: "Nom de la victime",
  descriptif_plainte: "Descriptif de la plainte",
};

type Table = keyof typeof TEXT_LIMITS;

// Premier champ trop long → message d'erreur lisible, sinon null.
export function checkTextLimits(
  table: Table,
  fields: Record<string, unknown>,
): string | null {
  const limits = TEXT_LIMITS[table] as Record<string, number>;
  for (const [column, max] of Object.entries(limits)) {
    const value = fields[column];
    if (typeof value === "string" && value.length > max) {
      const label = FIELD_LABELS[column] ?? column;
      return `« ${label} » est trop long : ${value.length.toLocaleString("fr-FR")} caractères pour ${max.toLocaleString("fr-FR")} maximum.`;
    }
  }
  return null;
}
