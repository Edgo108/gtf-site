"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/require";
import { removeParentFiles } from "@/lib/attachments/server";

type ActionResult = { error?: string; success?: boolean };

type ArchiveTable = "rapports" | "plaintes";

const PARENT_TYPES = { rapports: "rapport", plaintes: "plainte" } as const;

const LABELS: Record<ArchiveTable, string> = {
  rapports: "le rapport",
  plaintes: "la plainte",
};

async function restore(table: ArchiveTable, formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { error: "Identifiant manquant." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from(table)
    .update({ deleted_at: null })
    .eq("id", id);

  if (error) {
    return { error: `Impossible de restaurer ${LABELS[table]}.` };
  }

  revalidatePath("/admin/archives/corbeille");
  revalidatePath(`/archives/${table}`);
  return { success: true };
}

async function destroy(table: ArchiveTable, formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { error: "Identifiant manquant." };
  }

  const admin = createAdminClient();
  // Garde-fou : seule une fiche déjà en corbeille peut être supprimée
  // définitivement.
  const { data, error } = await admin
    .from(table)
    .delete()
    .eq("id", id)
    .not("deleted_at", "is", null)
    .select("id");

  if (error) {
    return { error: `Impossible de supprimer définitivement ${LABELS[table]}.` };
  }
  // Fiche effacée : ses pièces jointes aussi (lignes par trigger,
  // fichiers ici).
  if (data && data.length > 0) {
    await removeParentFiles(PARENT_TYPES[table], id);
  }

  revalidatePath("/admin/archives/corbeille");
  return { success: true };
}

export async function restoreRapport(formData: FormData): Promise<ActionResult> {
  return restore("rapports", formData);
}

export async function permanentlyDeleteRapport(
  formData: FormData,
): Promise<ActionResult> {
  return destroy("rapports", formData);
}

export async function restorePlainte(formData: FormData): Promise<ActionResult> {
  return restore("plaintes", formData);
}

export async function permanentlyDeletePlainte(
  formData: FormData,
): Promise<ActionResult> {
  return destroy("plaintes", formData);
}
