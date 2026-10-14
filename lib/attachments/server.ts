import type { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPseudoMap } from "@/lib/archives/agents";
import { canAccessEnquetes, uniteCanWrite } from "@/lib/permissions";
import {
  ATTACHMENT_DRAFTS_FIELD,
  ATTACHMENTS_BUCKET,
  MAX_ATTACHMENT_BYTES,
  UUID_RE,
  attachmentFolder,
  attachmentKind,
  type AttachmentParentType,
  type AttachmentView,
} from "@/lib/attachments/types";

// Pièces jointes, côté serveur uniquement. Les lectures et écritures se
// font avec la session de l'agent : la RLS de `attachments` et les
// policies du bucket (supabase/attachments.sql) restent la source de
// vérité. Les helpers de permission ci-dessous ne servent qu'à afficher
// ou masquer les boutons.

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;
type Actor = { role?: string | null; unite?: string | null };

// Miniatures : une heure, comme les photos des mandats.
const THUMBNAIL_TTL_SECONDS = 60 * 60;

// Nombre maximal de fichiers enregistrés en une fois (formulaire).
const MAX_DRAFTS = 50;

export function canReadAttachments(
  type: AttachmentParentType,
  actor: Actor,
): boolean {
  return type === "investigation" ? canAccessEnquetes(actor) : true;
}

export function canWriteAttachments(
  type: AttachmentParentType,
  actor: Actor,
): boolean {
  return type === "investigation" ? uniteCanWrite("enquetes", actor) : true;
}

type AttachmentRow = Omit<AttachmentView, "uploaded_by_pseudo" | "thumbnail_url"> & {
  uploaded_by: string | null;
};

const ROW_COLUMNS =
  "id, nom_fichier, storage_path, taille_octets, type_mime, created_at, uploaded_by";

async function toViews(
  supabase: ServerSupabase,
  rows: AttachmentRow[],
): Promise<AttachmentView[]> {
  const imagePaths = rows
    .filter((r) => attachmentKind(r.type_mime, r.nom_fichier) === "image")
    .map((r) => r.storage_path);

  const [pseudoById, signed] = await Promise.all([
    getPseudoMap(rows.map((r) => r.uploaded_by)),
    imagePaths.length
      ? supabase.storage
          .from(ATTACHMENTS_BUCKET)
          .createSignedUrls(imagePaths, THUMBNAIL_TTL_SECONDS)
      : Promise.resolve({ data: [] }),
  ]);
  const thumbByPath = new Map(
    (signed.data ?? []).flatMap((d) =>
      d.path && d.signedUrl ? [[d.path, d.signedUrl] as const] : [],
    ),
  );

  return rows.map(({ uploaded_by, ...row }) => ({
    ...row,
    uploaded_by_pseudo:
      (uploaded_by && pseudoById.get(uploaded_by)) || "Agent inconnu",
    thumbnail_url: thumbByPath.get(row.storage_path) ?? null,
  }));
}

// Liste des pièces jointes d'une fiche (vide si l'agent n'y a pas accès).
export async function loadAttachments(
  supabase: ServerSupabase,
  type: AttachmentParentType,
  parentId: string,
): Promise<AttachmentView[]> {
  const { data } = await supabase
    .from("attachments")
    .select(ROW_COLUMNS)
    .eq("parent_type", type)
    .eq("parent_id", parentId)
    .order("created_at", { ascending: true })
    .returns<AttachmentRow[]>();
  return toViews(supabase, data ?? []);
}

// Crée les lignes `attachments` de fichiers déjà déposés dans le dossier
// de la fiche (brouillons du formulaire de création, ou fichier tout juste
// envoyé depuis la fiche). La taille et le type sont relus dans le
// stockage, pas repris du navigateur ; un fichier absent est refusé.
// Idempotent : un fichier déjà enregistré est ignoré (nouvel essai après
// un échec).
export async function registerAttachmentRows(
  supabase: ServerSupabase,
  userId: string,
  type: AttachmentParentType,
  parentId: string,
  rawDrafts: unknown,
): Promise<{ error: string } | { attachments: AttachmentView[] }> {
  const invalid = { error: "Liste des pièces jointes invalide." };
  if (!Array.isArray(rawDrafts)) return invalid;
  if (rawDrafts.length === 0) return { attachments: [] };
  if (rawDrafts.length > MAX_DRAFTS) {
    return { error: `${MAX_DRAFTS} fichiers maximum par enregistrement.` };
  }

  const folder = attachmentFolder(type, parentId);
  const drafts: { storage_path: string; nom_fichier: string }[] = [];
  for (const item of rawDrafts) {
    const storage_path = String(item?.storage_path ?? "");
    const nom_fichier = String(item?.nom_fichier ?? "").trim().slice(0, 255);
    const fileName = storage_path.slice(folder.length + 1);
    if (
      !storage_path.startsWith(`${folder}/`) ||
      !fileName ||
      fileName.includes("/") ||
      !nom_fichier
    ) {
      return invalid;
    }
    drafts.push({ storage_path, nom_fichier });
  }

  const { data: objects, error: listError } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .list(folder, { limit: 1000 });
  if (listError) {
    return { error: "Impossible de vérifier les fichiers envoyés." };
  }
  const objectByPath = new Map(
    (objects ?? []).map((o) => [`${folder}/${o.name}`, o]),
  );

  const rows = [];
  for (const draft of drafts) {
    const object = objectByPath.get(draft.storage_path);
    if (!object) {
      return {
        error: `Le fichier « ${draft.nom_fichier} » est introuvable : renvoyez-le.`,
      };
    }
    const size = Number(object.metadata?.size ?? 0);
    if (size > MAX_ATTACHMENT_BYTES) {
      return { error: `« ${draft.nom_fichier} » dépasse 15 Mo.` };
    }
    rows.push({
      parent_type: type,
      parent_id: parentId,
      storage_path: draft.storage_path,
      nom_fichier: draft.nom_fichier,
      taille_octets: size,
      type_mime:
        String(object.metadata?.mimetype ?? "") || "application/octet-stream",
      uploaded_by: userId,
    });
  }

  const { error } = await supabase
    .from("attachments")
    .upsert(rows, { onConflict: "storage_path", ignoreDuplicates: true });
  if (error) {
    return { error: "Impossible d'enregistrer les pièces jointes." };
  }

  const { data } = await supabase
    .from("attachments")
    .select(ROW_COLUMNS)
    .in(
      "storage_path",
      rows.map((r) => r.storage_path),
    )
    .order("created_at", { ascending: true })
    .returns<AttachmentRow[]>();
  return { attachments: await toViews(supabase, data ?? []) };
}

// Suppression définitive d'une fiche : efface tout son dossier (fichiers
// enregistrés et brouillons éventuels). Les lignes `attachments` sont
// supprimées par trigger avec la fiche. Échec silencieux : les fichiers
// restants seront repris par le nettoyage des orphelins.
export async function removeParentFiles(
  type: AttachmentParentType,
  parentId: string,
): Promise<void> {
  const admin = createAdminClient();
  const folder = attachmentFolder(type, parentId);
  const { data } = await admin.storage
    .from(ATTACHMENTS_BUCKET)
    .list(folder, { limit: 1000 });
  const paths = (data ?? []).map((o) => `${folder}/${o.name}`);
  if (paths.length > 0) {
    await admin.storage.from(ATTACHMENTS_BUCKET).remove(paths);
  }
}

// --- Création d'une fiche avec ses pièces jointes ----------------------

// Identifiant choisi par le formulaire de création (voir
// useAttachmentDrafts). Absent ou mal formé : la base en génère un.
export function readNewRecordId(formData: FormData): { id?: string } {
  const id = String(formData.get("id") ?? "").trim();
  return UUID_RE.test(id) ? { id } : {};
}

// Brouillons envoyés avec le formulaire de création (JSON).
export function readAttachmentDrafts(formData: FormData): unknown {
  try {
    return JSON.parse(String(formData.get(ATTACHMENT_DRAFTS_FIELD) ?? "") || "[]");
  } catch {
    return null;
  }
}

export const ATTACHMENTS_SAVE_FAILED =
  "La fiche n'a pas été enregistrée. Vos fichiers sont conservés : réessayez.";
