import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PatchNoteCard } from "@/components/patch-notes/PatchNoteCard";
import { PatchNoteFilterBar } from "@/components/patch-notes/PatchNoteFilterBar";
import {
  isPatchNoteCategorie,
  type PatchNote,
} from "@/lib/supabase/patch-notes-types";

export default async function PatchNotesPage({
  searchParams,
}: {
  searchParams: Promise<{ categorie?: string }>;
}) {
  const { categorie } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single();

  const isAdmin = profile?.role === "admin";

  let query = supabase
    .from("patch_notes")
    .select("*")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (isPatchNoteCategorie(categorie)) {
    query = query.eq("categorie", categorie);
  }

  const { data: notes } = await query.returns<PatchNote[]>();

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
          Patch notes
        </h1>
        {isAdmin && (
          <Link
            href="/patch-notes/nouvelle"
            className="rounded bg-gtf-blue px-4 py-2 text-xs uppercase tracking-widest text-gtf-text hover:bg-gtf-blue-hover"
          >
            Nouvelle entrée
          </Link>
        )}
      </div>

      <p className="mt-1 font-mono text-sm text-gtf-text-muted">
        Journal des mises à jour du site.
      </p>

      {notes && notes.length > 0 && (
        <Suspense fallback={null}>
          <PatchNoteFilterBar />
        </Suspense>
      )}

      <div className="mt-6 flex flex-col gap-4">
        {notes?.map((note) => (
          <PatchNoteCard key={note.id} note={note} canManage={isAdmin} />
        ))}
        {notes && notes.length === 0 && (
          <p className="text-sm text-gtf-text-muted">
            Aucune entrée pour l&apos;instant.
          </p>
        )}
      </div>
    </div>
  );
}
