"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/require";
import { WANTED_PHOTOS_BUCKET, wantedPhotoPath } from "@/lib/wanted/photos";

// Corbeilles des mandats, opérations, annonces et patch notes :
// restauration et suppression définitive, admin uniquement.

type ActionResult = { error?: string; success?: boolean };

type Section = {
  table: string;
  label: string;
  listPath: string;
  trashPath: string;
};

const SECTIONS = {
  mandats: {
    table: "wanted_notices",
    label: "le mandat",
    listPath: "/mandats",
    trashPath: "/admin/mandats/corbeille",
  },
  operations: {
    table: "operations",
    label: "l'opération",
    listPath: "/operations",
    trashPath: "/admin/operations/corbeille",
  },
  annonces: {
    table: "announcements",
    label: "la notification",
    listPath: "/annonces",
    trashPath: "/admin/annonces/corbeille",
  },
  patchNotes: {
    table: "patch_notes",
    label: "l'entrée",
    listPath: "/patch-notes",
    trashPath: "/admin/patch-notes/corbeille",
  },
} satisfies Record<string, Section>;

async function restore(section: Section, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Identifiant manquant." };

  const { error } = await createAdminClient()
    .from(section.table)
    .update({ deleted_at: null })
    .eq("id", id);
  if (error) return { error: `Impossible de restaurer ${section.label}.` };

  revalidatePath(section.trashPath);
  revalidatePath(section.listPath);
  revalidatePath("/dashboard");
  return { success: true };
}

async function destroy(
  section: Section,
  formData: FormData,
  before?: (id: string) => Promise<void>,
): Promise<ActionResult> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Identifiant manquant." };

  await before?.(id);

  // Garde-fou : seule une fiche déjà en corbeille part définitivement.
  const { error } = await createAdminClient()
    .from(section.table)
    .delete()
    .eq("id", id)
    .not("deleted_at", "is", null);
  if (error) {
    return { error: `Impossible de supprimer définitivement ${section.label}.` };
  }

  revalidatePath(section.trashPath);
  return { success: true };
}

export async function restoreWantedNotice(formData: FormData) {
  return restore(SECTIONS.mandats, formData);
}

// La photo du mandat n'est effacée du stockage qu'à ce moment-là.
export async function permanentlyDeleteWantedNotice(formData: FormData) {
  return destroy(SECTIONS.mandats, formData, async (id) => {
    const admin = createAdminClient();
    const { data } = await admin
      .from("wanted_notices")
      .select("photo_url, deleted_at")
      .eq("id", id)
      .maybeSingle();
    if (data?.deleted_at && data.photo_url) {
      await admin.storage
        .from(WANTED_PHOTOS_BUCKET)
        .remove([wantedPhotoPath(data.photo_url)]);
    }
  });
}

export async function restoreOperation(formData: FormData) {
  return restore(SECTIONS.operations, formData);
}

export async function permanentlyDeleteOperation(formData: FormData) {
  return destroy(SECTIONS.operations, formData);
}

export async function restoreAnnouncement(formData: FormData) {
  return restore(SECTIONS.annonces, formData);
}

export async function permanentlyDeleteAnnouncement(formData: FormData) {
  return destroy(SECTIONS.annonces, formData);
}

export async function restorePatchNote(formData: FormData) {
  return restore(SECTIONS.patchNotes, formData);
}

export async function permanentlyDeletePatchNote(formData: FormData) {
  return destroy(SECTIONS.patchNotes, formData);
}
