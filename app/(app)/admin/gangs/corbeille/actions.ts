"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/require";

type ActionResult = { error?: string; success?: boolean };

export async function restoreGang(formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { error: "Identifiant manquant." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("gangs")
    .update({ deleted_at: null })
    .eq("id", id);

  if (error) {
    return { error: "Impossible de restaurer la fiche gang." };
  }

  revalidatePath("/admin/gangs/corbeille");
  revalidatePath("/gangs");
  return { success: true };
}

export async function permanentlyDeleteGang(
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { error: "Identifiant manquant." };
  }

  const admin = createAdminClient();

  // Zones et labos d'un gang ne doivent jamais disparaître en silence
  // avec lui (ils seraient supprimés en cascade, même actifs, sans passer
  // par la corbeille). On refuse tant qu'il en reste, corbeille comprise.
  // Doublé en base par supabase/gangs_delete_restrict.sql.
  const [{ count: zoneCount }, { count: labCount }] = await Promise.all([
    admin
      .from("sensitive_zones")
      .select("id", { count: "exact", head: true })
      .eq("gang_id", id),
    admin
      .from("lab_markers")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", id),
  ]);
  if ((zoneCount ?? 0) > 0 || (labCount ?? 0) > 0) {
    const parts = [
      zoneCount ? `${zoneCount} zone${zoneCount > 1 ? "s" : ""}` : null,
      labCount ? `${labCount} labo${labCount > 1 ? "s" : ""}` : null,
    ].filter(Boolean);
    return {
      error: `Suppression refusée : cette organisation a encore ${parts.join(" et ")} sur la carte (corbeille de la carte comprise). Supprimez-les ou restaurez puis réaffectez-les d'abord.`,
    };
  }

  const { error } = await admin.from("gangs").delete().eq("id", id);

  if (error) {
    return { error: "Impossible de supprimer définitivement la fiche gang." };
  }

  revalidatePath("/admin/gangs/corbeille");
  return { success: true };
}
