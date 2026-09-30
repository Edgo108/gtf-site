"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin as requireAdminContext } from "@/lib/auth/require";
import {
  isPatchNoteCategorie,
  todayISODate,
  type PatchNoteCategorie,
} from "@/lib/supabase/patch-notes-types";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkTextLimits } from "@/lib/limits";

type ActionResult = { error?: string };

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// L'admin est le seul rôle habilité à écrire (RLS l'impose aussi côté
// base : policies patch_notes_insert/update/delete → public.is_admin()).
async function requireAdmin() {
  try {
    const { supabase, user } = await requireAdminContext();
    return { supabase, user };
  } catch {
    return { error: "Accès réservé à l'administrateur." as const };
  }
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
  const tooLong = checkTextLimits("patch_notes", fields);
  if (tooLong) return { error: tooLong };
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
  const tooLong = checkTextLimits("patch_notes", fields);
  if (tooLong) return { error: tooLong };
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

  const admin = createAdminClient();
  const { error } = await admin
    .from("patch_notes")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return { error: "Impossible de supprimer l'entrée." };
  }

  revalidatePath("/patch-notes");
  revalidatePath("/dashboard");
  return {};
}
