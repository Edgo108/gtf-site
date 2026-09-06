"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type ActionResult = { error?: string; success?: boolean };

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Non authentifié.");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    throw new Error("Accès réservé aux administrateurs.");
  }
}

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
  const { error } = await admin.from("gangs").delete().eq("id", id);

  if (error) {
    return { error: "Impossible de supprimer définitivement la fiche gang." };
  }

  revalidatePath("/admin/gangs/corbeille");
  return { success: true };
}
