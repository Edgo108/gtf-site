import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";

// Garde des pages réservées à l'admin (corbeilles…). Défense en
// profondeur : le proxy bloque déjà les non-admins sur /admin/*.
export async function requireAdminPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/");
  }

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, statut")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin" || profile.statut !== "actif") {
    redirect("/dashboard");
  }

  return { user, supabase };
}
