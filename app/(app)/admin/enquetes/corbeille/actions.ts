"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/require";

type ActionResult = { error?: string; success?: boolean };

export async function restoreInvestigation(
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { error: "Identifiant manquant." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("investigations")
    .update({ deleted_at: null })
    .eq("id", id);

  if (error) {
    return { error: "Impossible de restaurer l'enquête." };
  }

  revalidatePath("/admin/enquetes/corbeille");
  revalidatePath("/enquetes");
  return { success: true };
}

export async function permanentlyDeleteInvestigation(
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { error: "Identifiant manquant." };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("investigations").delete().eq("id", id);

  if (error) {
    return { error: "Impossible de supprimer définitivement l'enquête." };
  }

  revalidatePath("/admin/enquetes/corbeille");
  return { success: true };
}
