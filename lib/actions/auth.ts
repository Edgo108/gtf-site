"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

// Changement de mot de passe OBLIGATOIRE (premier login, ou après une
// réinitialisation par un admin). Le mot de passe et le drapeau
// `doit_changer_mdp` sont mis à jour ensemble côté serveur : un agent ne
// peut plus lever le drapeau lui-même sans avoir réellement changé son
// mot de passe (la base lui retire ce droit, voir
// supabase/audit_lot3.sql).
export async function completeForcedPasswordChange(
  password: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Session expirée : reconnectez-vous." };
  }

  if (typeof password !== "string" || password.length < 8) {
    return { error: "Le mot de passe doit contenir au moins 8 caractères." };
  }

  const admin = createAdminClient();
  const { error: passwordError } = await admin.auth.admin.updateUserById(
    user.id,
    { password },
  );
  if (passwordError) {
    return { error: "Impossible de changer le mot de passe. Réessayez." };
  }

  const { error: flagError } = await admin
    .from("profiles")
    .update({ doit_changer_mdp: false })
    .eq("id", user.id);
  if (flagError) {
    return {
      error:
        "Mot de passe changé, mais une erreur est survenue. Contactez un administrateur.",
    };
  }

  return {};
}
