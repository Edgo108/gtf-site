"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createPatchNote,
  updatePatchNote,
} from "@/app/(app)/patch-notes/actions";
import {
  PATCH_NOTE_CATEGORIE_OPTIONS,
  type PatchNote,
} from "@/lib/supabase/patch-notes-types";

const fieldClass =
  "w-full rounded border border-gtf-border bg-gtf-panel-alt px-3 py-2 text-sm text-gtf-text focus:border-gtf-blue focus:outline-none";
const labelClass =
  "mb-1 block font-mono text-xs uppercase tracking-wider text-gtf-text-muted";

export function PatchNoteForm({
  note,
  defaultDate,
}: {
  note?: PatchNote;
  // Date du jour calculée côté serveur (pré-remplissage en création).
  defaultDate: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleAction(formData: FormData) {
    setError(null);
    if (note) {
      formData.set("id", note.id);
    }

    startTransition(async () => {
      const action = note ? updatePatchNote : createPatchNote;
      const result = await action(formData);
      if (result?.error) {
        setError(result.error);
      }
    });
  }

  return (
    <form action={handleAction} className="flex flex-col gap-5">
      <div>
        <label htmlFor="titre" className={labelClass}>
          Titre
        </label>
        <input
          id="titre"
          name="titre"
          type="text"
          required
          defaultValue={note?.titre}
          className={fieldClass}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="categorie" className={labelClass}>
            Catégorie
          </label>
          <select
            id="categorie"
            name="categorie"
            required
            defaultValue={note?.categorie ?? "nouveaute"}
            className={fieldClass}
          >
            {PATCH_NOTE_CATEGORIE_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="date" className={labelClass}>
            Date de publication
          </label>
          <input
            id="date"
            name="date"
            type="date"
            required
            defaultValue={note?.date ?? defaultDate}
            className={`${fieldClass} [color-scheme:dark]`}
          />
        </div>
      </div>

      <div>
        <label htmlFor="description" className={labelClass}>
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={8}
          defaultValue={note?.description}
          className={fieldClass}
        />
      </div>

      {error && (
        <p role="alert" className="text-xs text-gtf-red">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-gtf-blue px-5 py-2 text-xs font-medium uppercase tracking-widest text-gtf-text transition-colors hover:bg-gtf-blue-hover disabled:opacity-60"
        >
          {pending ? "..." : "Enregistrer"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded border border-gtf-border px-5 py-2 text-xs uppercase tracking-widest text-gtf-text-muted hover:text-gtf-text"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}
