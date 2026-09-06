"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pseudoToEmail } from "@/lib/auth/pseudo";

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

  return user;
}

export async function createAgent(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const pseudo = String(formData.get("pseudo") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const grade = String(formData.get("grade") ?? "").trim();

  if (!pseudo || !password || !grade) {
    return { error: "Tous les champs sont obligatoires." };
  }
  if (password.length < 8) {
    return { error: "Le mot de passe doit contenir au moins 8 caractères." };
  }

  const admin = createAdminClient();
  const email = pseudoToEmail(pseudo);

  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

  if (createError || !created.user) {
    return { error: "Ce pseudo est déjà utilisé ou invalide." };
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: created.user.id,
    pseudo,
    role: "agent",
    statut: "actif",
    grade,
    doit_changer_mdp: true,
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: "Ce pseudo est déjà utilisé." };
  }

  revalidatePath("/admin/agents");
  return { success: true };
}

export async function updateAgent(formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const pseudo = String(formData.get("pseudo") ?? "").trim();
  const grade = String(formData.get("grade") ?? "").trim();

  if (!id || !pseudo || !grade) {
    return { error: "Champs manquants." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ pseudo, grade })
    .eq("id", id);

  if (error) {
    return { error: "Impossible de mettre à jour l'agent (pseudo déjà pris ?)." };
  }

  revalidatePath("/admin/agents");
  return { success: true };
}

export async function toggleStatut(formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const current = String(formData.get("statut") ?? "");
  const next = current === "actif" ? "suspendu" : "actif";

  if (!id) {
    return { error: "Identifiant manquant." };
  }

  const admin = createAdminClient();

  const { error: banError } = await admin.auth.admin.updateUserById(id, {
    ban_duration: next === "suspendu" ? "876000h" : "none",
  });
  if (banError) {
    return { error: "Impossible de mettre à jour le compte." };
  }

  const { error } = await admin
    .from("profiles")
    .update({ statut: next })
    .eq("id", id);

  if (error) {
    return { error: "Impossible de mettre à jour le statut." };
  }

  revalidatePath("/admin/agents");
  return { success: true };
}

export async function resetAgentPassword(
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!id || !password) {
    return { error: "Champs manquants." };
  }
  if (password.length < 8) {
    return { error: "Le mot de passe doit contenir au moins 8 caractères." };
  }

  const admin = createAdminClient();

  const { error: passwordError } = await admin.auth.admin.updateUserById(
    id,
    { password },
  );
  if (passwordError) {
    return { error: "Impossible de réinitialiser le mot de passe." };
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({ doit_changer_mdp: true })
    .eq("id", id);

  if (profileError) {
    return {
      error:
        "Mot de passe réinitialisé, mais le profil n'a pas pu être mis à jour.",
    };
  }

  revalidatePath("/admin/agents");
  return { success: true };
}

export async function deleteAgent(formData: FormData): Promise<ActionResult> {
  const currentUser = await requireAdmin();

  const id = String(formData.get("id") ?? "");

  if (!id) {
    return { error: "Identifiant manquant." };
  }
  if (id === currentUser.id) {
    return { error: "Vous ne pouvez pas supprimer votre propre compte." };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) {
    return { error: "Impossible de supprimer ce compte." };
  }

  revalidatePath("/admin/agents");
  return { success: true };
}
