import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AnnouncementForm } from "@/components/announcements/AnnouncementForm";
import { uniteCanWrite } from "@/lib/permissions";

const AUTHOR_GRADES = ["Lieutenant", "Commandant"];

export default async function NouvelleAnnoncePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("grade, role, unite")
    .eq("id", user.id)
    .single();

  // Défense en profondeur : la RLS bloque déjà l'insertion côté base.
  if (
    !profile ||
    !AUTHOR_GRADES.includes(profile.grade) ||
    !uniteCanWrite("annonces", profile)
  ) {
    redirect("/annonces");
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
        Nouvelle notification
      </h1>
      <div className="mt-6">
        <AnnouncementForm />
      </div>
    </div>
  );
}
