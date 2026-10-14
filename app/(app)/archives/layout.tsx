import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { canAccessArchives } from "@/lib/permissions";

// Garde serveur de tout le dossier /archives (liste, rapports, plaintes,
// fiches, formulaires) : le DOJ n'y a aucun accès, même par une URL tapée
// à la main. La RLS refuse de toute façon les données
// (supabase/archives_doj_lockout.sql) ; ceci évite d'afficher des pages
// vides ou trompeuses.
export default async function ArchivesLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, unite")
    .eq("id", user.id)
    .single();

  if (!canAccessArchives(profile ?? {})) {
    redirect("/dashboard");
  }

  return children;
}
