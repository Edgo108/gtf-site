import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PatchNoteForm } from "@/components/patch-notes/PatchNoteForm";
import {
  todayISODate,
  type PatchNote,
} from "@/lib/supabase/patch-notes-types";

export default async function ModifierPatchNotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  // Défense en profondeur : la RLS bloque déjà la modification côté base.
  if (profile?.role !== "admin") {
    redirect("/patch-notes");
  }

  const { data: note } = await supabase
    .from("patch_notes")
    .select("*")
    .eq("id", id)
    .single<PatchNote>();

  if (!note) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
        Modifier l&apos;entrée
      </h1>
      <div className="mt-6">
        <PatchNoteForm note={note} defaultDate={todayISODate()} />
      </div>
    </div>
  );
}
