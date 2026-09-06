"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createAnnouncement,
  updateAnnouncement,
} from "@/app/(app)/annonces/actions";
import type { Announcement } from "@/lib/supabase/announcements-types";

const PRIORITES = [
  { value: "normale", label: "Normale" },
  { value: "urgente", label: "Urgente" },
];

const fieldClass =
  "w-full rounded border border-gtf-border bg-gtf-panel-alt px-3 py-2 text-sm text-gtf-text focus:border-gtf-blue focus:outline-none";
const labelClass =
  "mb-1 block font-mono text-xs uppercase tracking-wider text-gtf-text-muted";

export function AnnouncementForm({
  announcement,
}: {
  announcement?: Announcement;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleAction(formData: FormData) {
    setError(null);
    if (announcement) {
      formData.set("id", announcement.id);
    }

    startTransition(async () => {
      const action = announcement ? updateAnnouncement : createAnnouncement;
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
          defaultValue={announcement?.titre}
          className={fieldClass}
        />
      </div>

      <div>
        <label htmlFor="priorite" className={labelClass}>
          Priorité
        </label>
        <select
          id="priorite"
          name="priorite"
          defaultValue={announcement?.priorite ?? "normale"}
          className={fieldClass}
        >
          {PRIORITES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="message" className={labelClass}>
          Message
        </label>
        <textarea
          id="message"
          name="message"
          rows={6}
          defaultValue={announcement?.message}
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
