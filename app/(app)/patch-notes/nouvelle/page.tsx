import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PatchNoteForm } from "@/components/patch-notes/PatchNoteForm";
import { todayISODate } from "@/lib/supabase/patch-notes-types";

export default async function NouvellePatchNotePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  // Défense en profondeur : la RLS bloque déjà l'insertion côté base.
  if (profile?.role !== "admin") {
    redirect("/patch-notes");
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
        Nouvelle entrée
      </h1>
      <div className="mt-6">
        <PatchNoteForm defaultDate={todayISODate()} />
      </div>
    </div>
  );
}
