"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/require";

type ActionResult = { error?: string; success?: boolean };

export async function restoreZone(formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Identifiant manquant." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("sensitive_zones")
    .update({ deleted_at: null })
    .eq("id", id);

  if (error) {
    return { error: "Impossible de restaurer la zone." };
  }

  revalidatePath("/admin/zones/corbeille");
  revalidatePath("/zones");
  return { success: true };
}

export async function permanentlyDeleteZone(
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Identifiant manquant." };

  const admin = createAdminClient();
  const { error } = await admin.from("sensitive_zones").delete().eq("id", id);

  if (error) {
    return { error: "Impossible de supprimer définitivement la zone." };
  }

  revalidatePath("/admin/zones/corbeille");
  return { success: true };
}

export async function restoreLabMarker(
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Identifiant manquant." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("lab_markers")
    .update({ deleted_at: null })
    .eq("id", id);

  if (error) {
    return { error: "Impossible de restaurer le marqueur laboratoire." };
  }

  revalidatePath("/admin/zones/corbeille");
  revalidatePath("/zones");
  return { success: true };
}

export async function permanentlyDeleteLabMarker(
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Identifiant manquant." };

  const admin = createAdminClient();
  const { error } = await admin.from("lab_markers").delete().eq("id", id);

  if (error) {
    return {
      error: "Impossible de supprimer définitivement le marqueur laboratoire.",
    };
  }

  revalidatePath("/admin/zones/corbeille");
  return { success: true };
}
