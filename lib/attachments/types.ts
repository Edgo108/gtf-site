// Pièces jointes des Enquêtes, Rapports et Plaintes (table `attachments`
// + bucket privé `archives-attachments`, voir supabase/attachments.sql).
// Module partagé client / serveur : aucune dépendance serveur ici.

export const ATTACHMENTS_BUCKET = "archives-attachments";

// 15 Mo — même limite que `file_size_limit` du bucket et que le CHECK
// de `attachments.taille_octets`.
export const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;

export const ATTACHMENT_PARENT_TYPES = [
  "investigation",
  "rapport",
  "plainte",
] as const;
export type AttachmentParentType = (typeof ATTACHMENT_PARENT_TYPES)[number];

export function isAttachmentParentType(
  value: unknown,
): value is AttachmentParentType {
  return (
    typeof value === "string" &&
    (ATTACHMENT_PARENT_TYPES as readonly string[]).includes(value)
  );
}

// Page détail de la fiche parente (revalidation après ajout/suppression).
export const ATTACHMENT_PARENT_PATHS: Record<AttachmentParentType, string> = {
  investigation: "/enquetes",
  rapport: "/archives/rapports",
  plainte: "/archives/plaintes",
};

// Pièce jointe telle qu'affichée dans la liste.
export type AttachmentView = {
  id: string;
  nom_fichier: string;
  storage_path: string;
  taille_octets: number;
  type_mime: string;
  created_at: string;
  uploaded_by_pseudo: string;
  // URL signée de la miniature (images uniquement), sinon null.
  thumbnail_url: string | null;
};

// Fichier déposé pendant la création d'une fiche, pas encore enregistré
// en base : envoyé avec le formulaire (champ ATTACHMENT_DRAFTS_FIELD).
export type AttachmentDraft = {
  storage_path: string;
  nom_fichier: string;
  taille_octets: number;
  type_mime: string;
};

export const ATTACHMENT_DRAFTS_FIELD = "attachment_drafts";

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function tooLargeMessage(fileName: string): string {
  return `« ${fileName} » dépasse la taille maximale de 15 Mo par fichier.`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;
}

export type AttachmentKind = "image" | "pdf" | "other";

export function attachmentKind(mime: string, name: string): AttachmentKind {
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf" || /\.pdf$/i.test(name)) return "pdf";
  return "other";
}

// Dossier de la fiche dans le bucket.
export function attachmentFolder(
  type: AttachmentParentType,
  parentId: string,
): string {
  return `${type}/${parentId}`;
}

// Le stockage Supabase refuse certains caractères dans les chemins
// (accents, espaces spéciaux…) : le chemin utilise un nom simplifié, le
// nom d'origine est conservé dans `nom_fichier`.
function safeFileName(name: string): string {
  const cleaned = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[_.]+/, "");
  return (cleaned || "fichier").slice(-100);
}

export function buildAttachmentPath(
  type: AttachmentParentType,
  parentId: string,
  fileName: string,
): string {
  return `${attachmentFolder(type, parentId)}/${crypto.randomUUID()}-${safeFileName(fileName)}`;
}
