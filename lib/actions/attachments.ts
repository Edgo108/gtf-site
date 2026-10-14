"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireActiveUser, requireAdmin } from "@/lib/auth/require";
import { registerAttachmentRows } from "@/lib/attachments/server";
import {
  ATTACHMENT_PARENT_PATHS,
  ATTACHMENTS_BUCKET,
  UUID_RE,
  isAttachmentParentType,
  type AttachmentDraft,
  type AttachmentView,
} from "@/lib/attachments/types";

// Pièces jointes d'une fiche DÉJÀ enregistrée (vue détaillée, formulaire
// de modification). Pendant la création, les fichiers sont enregistrés
// avec la fiche par son action de création (voir lib/attachments/server).

// Enregistre en base des fichiers que le navigateur vient de déposer dans
// le dossier de la fiche.
export async function registerAttachments(
  parentType: string,
  parentId: string,
  drafts: AttachmentDraft[],
): Promise<{ error?: string; attachments?: AttachmentView[] }> {
  const { supabase, user } = await requireActiveUser();
  if (!isAttachmentParentType(parentType) || !UUID_RE.test(parentId)) {
    return { error: "Fiche invalide." };
  }

  const result = await registerAttachmentRows(
    supabase,
    user.id,
    parentType,
    parentId,
    drafts,
  );
  if ("error" in result) return result;

  revalidatePath(`${ATTACHMENT_PARENT_PATHS[parentType]}/${parentId}`);
  return { attachments: result.attachments };
}

export async function deleteAttachment(
  id: string,
): Promise<{ error?: string }> {
  const { supabase } = await requireActiveUser();
  if (!UUID_RE.test(id)) return { error: "Pièce jointe invalide." };

  // Ligne d'abord (la RLS vérifie le droit de modifier la fiche), fichier
  // ensuite : un fichier qui resterait sans ligne serait repris par le
  // nettoyage des orphelins, alors qu'une ligne sans fichier resterait
  // visible et cassée.
  const { data, error } = await supabase
    .from("attachments")
    .delete()
    .eq("id", id)
    .select("storage_path, parent_type, parent_id");
  if (error) {
    return { error: "Impossible de supprimer la pièce jointe." };
  }
  const row = data?.[0];
  if (!row) {
    return {
      error:
        "Pièce jointe introuvable, ou vous n'avez pas le droit de modifier cette fiche.",
    };
  }

  await supabase.storage.from(ATTACHMENTS_BUCKET).remove([row.storage_path]);

  if (isAttachmentParentType(row.parent_type)) {
    revalidatePath(`${ATTACHMENT_PARENT_PATHS[row.parent_type]}/${row.parent_id}`);
  }
  return {};
}

// Fichiers sans fiche enregistrée depuis plus d'une journée (création
// abandonnée sans passer par « Annuler », onglet fermé…). Le délai laisse
// le temps de finir une fiche en cours de rédaction.
const ORPHAN_MIN_AGE = "24 hours";

export async function cleanupOrphanAttachments(): Promise<{
  error?: string;
  removed?: number;
}> {
  await requireAdmin();

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("list_orphan_attachment_objects", {
    p_min_age: ORPHAN_MIN_AGE,
  });
  if (error) {
    return { error: "Impossible de lister les fichiers orphelins." };
  }

  const paths = (data ?? []) as string[];
  for (let i = 0; i < paths.length; i += 100) {
    const { error: removeError } = await admin.storage
      .from(ATTACHMENTS_BUCKET)
      .remove(paths.slice(i, i + 100));
    if (removeError) {
      return { error: "Le nettoyage a été interrompu, réessayez." };
    }
  }
  return { removed: paths.length };
}
