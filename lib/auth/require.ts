import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/supabase/types";

// Contrôles d'accès communs à toutes les Server Actions. Module serveur
// ordinaire (pas "use server") : ces fonctions ne sont PAS exposées comme
// actions appelables depuis le navigateur.
//
// Le statut « actif » est vérifié ici en plus de la RLS : plusieurs
// actions écrivent avec la clé service_role (corbeille, verrous), qui
// contourne la RLS. Un compte suspendu ne doit jamais y arriver, même si
// son jeton de session est encore valide.

export type Actor = Pick<Profile, "pseudo" | "role" | "grade" | "unite" | "statut">;

export async function requireActiveUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Non authentifié.");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("pseudo, role, grade, unite, statut")
    .eq("id", user.id)
    .single<Actor>();

  if (!profile || profile.statut !== "actif") {
    throw new Error("Compte suspendu ou introuvable.");
  }

  return { supabase, user, profile };
}

export async function requireAdmin() {
  const context = await requireActiveUser();
  if (context.profile.role !== "admin") {
    throw new Error("Accès réservé aux administrateurs.");
  }
  return context;
}
