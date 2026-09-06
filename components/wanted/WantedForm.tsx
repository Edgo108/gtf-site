"use client";

import { useState, useTransition, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { createWantedNotice, updateWantedNotice } from "@/app/(app)/mandats/actions";
import type { WantedNotice } from "@/lib/supabase/wanted-notices-types";

const NIVEAUX = [
  { value: "faible", label: "Faible" },
  { value: "moyen", label: "Moyen" },
  { value: "eleve", label: "Élevé" },
];

const STATUTS = [
  { value: "actif", label: "Actif" },
  { value: "capture", label: "Capturé" },
];

const fieldClass =
  "w-full rounded border border-gtf-border bg-gtf-panel-alt px-3 py-2 text-sm text-gtf-text focus:border-gtf-blue focus:outline-none";
const labelClass =
  "mb-1 block font-mono text-xs uppercase tracking-wider text-gtf-text-muted";

export function WantedForm({ notice }: { notice?: WantedNotice }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState<string | null>(
    notice?.photo_url ?? null,
  );

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      setPreview(URL.createObjectURL(file));
    }
  }

  function handleAction(formData: FormData) {
    setError(null);
    if (notice) {
      formData.set("id", notice.id);
    }

    startTransition(async () => {
      const action = notice ? updateWantedNotice : createWantedNotice;
      const result = await action(formData);
      if (result?.error) {
        setError(result.error);
      }
    });
  }

  return (
    <form action={handleAction} className="flex flex-col gap-5">
      <div>
        <label className={labelClass}>Photo</label>
        <div className="flex items-center gap-4">
          <div className="relative h-32 w-24 shrink-0 overflow-hidden rounded border border-gtf-border bg-gtf-panel-alt">
            {preview ? (
              // Prévisualisation locale (blob:) — next/image ne convient
              // pas ici, l'affichage final réutilise WantedPhoto.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center p-1 text-center font-mono text-[10px] uppercase tracking-wider text-gtf-text-muted">
                Photo non disponible
              </div>
            )}
          </div>
          <input
            type="file"
            name="photo"
            accept="image/png,image/jpeg,image/webp"
            onChange={handlePhotoChange}
            className="text-xs text-gtf-text-muted file:mr-3 file:rounded file:border file:border-gtf-border file:bg-gtf-panel-alt file:px-3 file:py-1.5 file:text-xs file:text-gtf-text file:uppercase file:tracking-wider hover:file:border-gtf-blue"
          />
        </div>
      </div>

      <div>
        <label htmlFor="nom_suspect" className={labelClass}>
          Nom du suspect
        </label>
        <input
          id="nom_suspect"
          name="nom_suspect"
          type="text"
          required
          defaultValue={notice?.nom_suspect}
          className={fieldClass}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="niveau_dangerosite" className={labelClass}>
            Niveau de dangerosité
          </label>
          <select
            id="niveau_dangerosite"
            name="niveau_dangerosite"
            defaultValue={notice?.niveau_dangerosite ?? "moyen"}
            className={fieldClass}
          >
            {NIVEAUX.map((n) => (
              <option key={n.value} value={n.value}>
                {n.label}
              </option>
            ))}
          </select>
        </div>

        {notice && (
          <div>
            <label htmlFor="statut" className={labelClass}>
              Statut
            </label>
            <select
              id="statut"
              name="statut"
              defaultValue={notice.statut}
              className={fieldClass}
            >
              {STATUTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div>
        <label htmlFor="description" className={labelClass}>
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={5}
          defaultValue={notice?.description}
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
