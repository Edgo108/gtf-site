// Données d'un export PDF de Rapport / Plainte, préparées par le serveur
// (lib/actions/archive-pdf.ts) avec la session de l'agent, puis mises en
// page dans le navigateur (lib/pdf/archive-pdf.ts). Tout est déjà
// formaté (dates en heure de Paris, montants) : le navigateur ne fait
// que la mise en page.

export type ArchivePdfKind = "rapport" | "plainte";

export type PdfField =
  | { kind: "text"; label: string; value: string }
  | { kind: "list"; label: string; items: string[] }
  | { kind: "signature"; label: string; name: string | null };

export type PdfInfraction = {
  numeroArticle: string;
  titre: string;
  categorie: string;
  // Montant calculé (articles à formule uniquement), déjà formaté.
  montantCalcule: string | null;
};

export type PdfAttachment = {
  nom: string;
  typeMime: string;
  taille: string;
  ajouteLe: string;
  ajoutePar: string;
  // URL signée de courte durée (session de l'agent, ou admin pour une
  // fiche en corbeille).
  url: string | null;
};

export type ArchivePdfData = {
  kind: ArchivePdfKind;
  // « RAPPORT » / « PLAINTE ».
  typeLabel: string;
  // « N° 007 » ou « TEST-003 ».
  numeroLabel: string;
  estTest: boolean;
  enCorbeille: boolean;
  dateRedaction: string;
  fields: PdfField[];
  // Rapport uniquement (null pour une plainte).
  infractions: {
    lines: PdfInfraction[];
    amendeMin: string;
    amendeMax: string;
    prison: string;
  } | null;
  attachments: PdfAttachment[];
  generatedBy: string;
  generatedAt: string;
  fileName: string;
};
