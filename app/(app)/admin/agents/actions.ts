"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { pseudoToEmail } from "@/lib/auth/pseudo";
import { EDGO_ACCOUNT_ID } from "@/lib/constants";
import { canManageUnite, isUnite, UNITES } from "@/lib/permissions";
import { requireActiveUser, requireAdmin } from "@/lib/auth/require";

type ActionResult = { error?: string; success?: boolean };

// L'admin OU un grade habilité (Commandant / Capitaine / Lieutenant).
// Sert uniquement à la réattribution du rôle/unité d'un compte.
async function requireUniteManager() {
  const { user, profile } = await requireActiveUser();

  if (!canManageUnite(profile)) {
    throw new Error(
      "Seuls l'administrateur et les grades Commandant / Capitaine / Lieutenant peuvent réattribuer une unité.",
    );
  }

  return { user, isAdmin: profile.role === "admin" };
}

export async function createAgent(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const pseudo = String(formData.get("pseudo") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const grade = String(formData.get("grade") ?? "").trim();
  const uniteRaw = String(formData.get("unite") ?? "SASP").trim();
  const unite = isUnite(uniteRaw) ? uniteRaw : "SASP";

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
    // L'identifiant de connexion dérive du pseudo À LA CRÉATION et ne suit
    // jamais les renommages : il peut donc être déjà pris par un compte
    // renommé depuis (ex. identifiant « edgo »).
    return {
      error: `Identifiant de connexion « ${email.split("@")[0]} » déjà utilisé par un autre compte (éventuellement renommé depuis), ou pseudo invalide.`,
    };
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: created.user.id,
    pseudo,
    role: "agent",
    statut: "actif",
    grade,
    unite,
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

// Réattribution du rôle/unité d'un compte. Accessible à l'admin ET aux
// grades Commandant / Capitaine / Lieutenant (et à eux seuls). C'est le
// SEUL chemin d'écriture de `profiles.unite` : la base refuse toute
// modification directe avec un jeton utilisateur (privilège de colonne
// retiré + trigger enforce_profile_cross_update, voir
// supabase/profiles_unite_lockdown.sql).
export async function updateAgentUnite(
  formData: FormData,
): Promise<ActionResult> {
  const { user, isAdmin } = await requireUniteManager();

  const id = String(formData.get("id") ?? "");
  const uniteRaw = String(formData.get("unite") ?? "").trim();

  if (!id) {
    return { error: "Identifiant manquant." };
  }
  if (!isUnite(uniteRaw)) {
    return { error: `Unité invalide (attendu : ${UNITES.join(", ")}).` };
  }

  const admin = createAdminClient();

  // Un manager d'unité (grade) qui n'est pas admin ne peut ni changer sa
  // propre unité (auto-promotion, ex. SASP → EM) ni celle d'un admin.
  if (!isAdmin) {
    if (id === user.id) {
      return { error: "Vous ne pouvez pas modifier votre propre unité." };
    }
    const { data: target } = await admin
      .from("profiles")
      .select("role")
      .eq("id", id)
      .maybeSingle();
    if (!target) {
      return { error: "Compte introuvable." };
    }
    if (target.role === "admin") {
      return { error: "Seul un administrateur peut modifier l'unité d'un administrateur." };
    }
  }
  const { error } = await admin
    .from("profiles")
    .update({ unite: uniteRaw })
    .eq("id", id);

  if (error) {
    return { error: "Impossible de mettre à jour l'unité du compte." };
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
  const { user: currentUser } = await requireAdmin();

  const id = String(formData.get("id") ?? "");

  if (!id) {
    return { error: "Identifiant manquant." };
  }
  if (id === EDGO_ACCOUNT_ID) {
    return { error: "Ce compte est protégé : sa suppression est impossible." };
  }
  if (id === currentUser.id) {
    return { error: "Vous ne pouvez pas supprimer votre propre compte." };
  }

  const admin = createAdminClient();

  // Rapports, plaintes (corbeille comprise) et opérations gardent leur
  // agent rédacteur / lead : la base refuse la suppression d'un compte
  // qui en a encore (on delete restrict). On l'explique au lieu d'échouer.
  const countOf = (table: string, column: string) =>
    admin.from(table).select("id", { count: "exact", head: true }).eq(column, id);
  const [{ count: leads }, { count: rapports }, { count: plaintes }] =
    await Promise.all([
      countOf("operations", "lead_id"),
      countOf("rapports", "agent_redacteur_id"),
      countOf("plaintes", "agent_redacteur_id"),
    ]);
  const blockers = [
    leads ? `lead de ${leads} opération${leads > 1 ? "s" : ""}` : null,
    rapports ? `rédacteur de ${rapports} rapport${rapports > 1 ? "s" : ""}` : null,
    plaintes ? `rédacteur de ${plaintes} plainte${plaintes > 1 ? "s" : ""}` : null,
  ].filter(Boolean);
  if (blockers.length > 0) {
    return {
      error: `Suppression impossible : ce compte est ${blockers.join(", ")} (corbeille comprise). Suspendez-le plutôt. (Pour les rapports et plaintes, on peut aussi changer leur agent rédacteur ; le lead d'une opération, lui, ne se transfère pas.)`,
    };
  }

  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) {
    return { error: "Impossible de supprimer ce compte." };
  }

  revalidatePath("/admin/agents");
  return { success: true };
}
