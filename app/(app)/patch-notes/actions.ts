"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  isPatchNoteCategorie,
  todayISODate,
  type PatchNoteCategorie,
} from "@/lib/supabase/patch-notes-types";

type ActionResult = { error?: string };

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// L'admin est le seul rôle habilité à écrire (RLS l'impose aussi côté
// base : policies patch_notes_insert/update/delete → public.is_admin()).
async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Non authentifié." as const };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return { error: "Accès réservé à l'administrateur." as const };
  }

  return { supabase, user };
}

function readFields(formData: FormData) {
  const titre = String(formData.get("titre") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  const categorieRaw = String(formData.get("categorie") ?? "nouveaute");
  const categorie: PatchNoteCategorie = isPatchNoteCategorie(categorieRaw)
    ? categorieRaw
    : "nouveaute";

  const dateRaw = String(formData.get("date") ?? "");
  const date = DATE_REGEX.test(dateRaw) ? dateRaw : todayISODate();

  return { titre, description, categorie, date };
}

export async function createPatchNote(
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const fields = readFields(formData);
  if (!fields.titre) {
    return { error: "Le titre est obligatoire." };
  }

  const { error } = await auth.supabase
    .from("patch_notes")
    .insert({ ...fields, created_by: auth.user.id });

  if (error) {
    return { error: "Impossible de créer l'entrée." };
  }

  revalidatePath("/patch-notes");
  revalidatePath("/dashboard");
  redirect("/patch-notes");
}

export async function updatePatchNote(
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { error: "Identifiant manquant." };
  }

  const fields = readFields(formData);
  if (!fields.titre) {
    return { error: "Le titre est obligatoire." };
  }

  const { error } = await auth.supabase
    .from("patch_notes")
    .update(fields)
    .eq("id", id);

  if (error) {
    return { error: "Impossible de modifier l'entrée." };
  }

  revalidatePath("/patch-notes");
  revalidatePath("/dashboard");
  redirect("/patch-notes");
}

export async function deletePatchNote(
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { error: "Identifiant manquant." };
  }

  const { error } = await auth.supabase
    .from("patch_notes")
    .delete()
    .eq("id", id);

  if (error) {
    return { error: "Impossible de supprimer l'entrée." };
  }

  revalidatePath("/patch-notes");
  revalidatePath("/dashboard");
  return {};
}
