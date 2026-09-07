import Link from "next/link";
import { PatchNoteCategorieBadge } from "@/components/patch-notes/PatchNoteCategorieBadge";
import { DeletePatchNoteButton } from "@/components/patch-notes/DeletePatchNoteButton";
import {
  formatPatchDate,
  type PatchNote,
} from "@/lib/supabase/patch-notes-types";

export function PatchNoteCard({
  note,
  canManage,
}: {
  note: PatchNote;
  canManage: boolean;
}) {
  return (
    <article className="rounded-md border border-gtf-border bg-gtf-panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <PatchNoteCategorieBadge categorie={note.categorie} />
          <h2 className="font-display text-base font-semibold uppercase tracking-wide text-gtf-text">
            {note.titre}
          </h2>
        </div>
        <span className="shrink-0 font-mono text-xs text-gtf-text-muted">
          {formatPatchDate(note.date)}
        </span>
      </div>

      {note.description && (
        <p className="mt-3 whitespace-pre-wrap text-sm text-gtf-text">
          {note.description}
        </p>
      )}

      {canManage && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-gtf-border pt-3">
          <Link
            href={`/patch-notes/${note.id}/modifier`}
            className="rounded border border-gtf-border px-3 py-1 text-xs uppercase tracking-wider text-gtf-text-muted hover:text-gtf-text"
          >
            Modifier
          </Link>
          <DeletePatchNoteButton id={note.id} titre={note.titre} />
        </div>
      )}
    </article>
  );
}
