import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminPage } from "@/lib/auth/require-page";
import { TrashTable } from "@/components/ui/TrashTable";
import { PatchNoteCategorieBadge } from "@/components/patch-notes/PatchNoteCategorieBadge";
import {
  permanentlyDeletePatchNote,
  restorePatchNote,
} from "@/app/(app)/admin/corbeille/actions";
import { formatPatchDate, type PatchNote } from "@/lib/supabase/patch-notes-types";

export default async function CorbeillePatchNotesPage() {
  await requireAdminPage();

  const { data } = await createAdminClient()
    .from("patch_notes")
    .select("id, titre, categorie, date, deleted_at")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false })
    .returns<Pick<PatchNote, "id" | "titre" | "categorie" | "date" | "deleted_at">[]>();
  const rows = data ?? [];

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
        Corbeille — Patch notes
      </h1>
      <p className="mt-1 font-mono text-sm text-gtf-text-muted">
        {rows.length} entrée(s) supprimée(s)
      </p>

      <div className="mt-6">
        <TrashTable
          columns={["Titre", "Catégorie", "Date"]}
          deletedLabel="Supprimée le"
          rows={rows.map((n) => ({
            id: n.id,
            name: n.titre,
            deletedAt: n.deleted_at ?? null,
            cells: [
              n.titre,
              <PatchNoteCategorieBadge key="cat" categorie={n.categorie} />,
              <span key="date" className="font-mono text-xs">
                {formatPatchDate(n.date)}
              </span>,
            ],
          }))}
          restore={restorePatchNote}
          destroy={permanentlyDeletePatchNote}
          restoreSuccess="Entrée restaurée"
          destroySuccess="Entrée supprimée définitivement"
          destroyConfirm="Supprimer définitivement l'entrée"
        />
      </div>
    </div>
  );
}
