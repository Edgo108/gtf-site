"use client";

import { useState, useTransition } from "react";
import { deletePatchNote } from "@/app/(app)/patch-notes/actions";

export function DeletePatchNoteButton({
  id,
  titre,
}: {
  id: string;
  titre: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    if (
      !window.confirm(
        `Supprimer définitivement l'entrée « ${titre} » ? Cette action est irréversible.`,
      )
    ) {
      return;
    }
    setError(null);
    const formData = new FormData();
    formData.set("id", id);

    startTransition(async () => {
      const result = await deletePatchNote(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div>
      <button
        onClick={handleDelete}
        disabled={pending}
        className="rounded border border-gtf-red px-3 py-1 text-xs uppercase tracking-wider text-gtf-red hover:bg-gtf-red/10 disabled:opacity-60"
      >
        Supprimer
      </button>
      {error && (
        <p role="alert" className="mt-1 text-xs text-gtf-red">
          {error}
        </p>
      )}
    </div>
  );
}
