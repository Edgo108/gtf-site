"use client";

import { useState, useTransition } from "react";
import { deleteGang } from "@/app/(app)/gangs/actions";

export function DeleteGangButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    if (!window.confirm("Déplacer cette fiche gang vers la corbeille ?")) {
      return;
    }
    setError(null);
    const formData = new FormData();
    formData.set("id", id);

    startTransition(async () => {
      const result = await deleteGang(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div>
      <button
        onClick={handleDelete}
        disabled={pending}
        className="rounded border border-gtf-red px-4 py-2 text-xs uppercase tracking-widest text-gtf-red hover:bg-gtf-red/10 disabled:opacity-60"
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
