"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createAnnouncement,
  updateAnnouncement,
} from "@/app/(app)/annonces/actions";
import type { Announcement } from "@/lib/supabase/announcements-types";
import { FormFooter } from "@/components/ui/FormFooter";
import { useActionRunner } from "@/lib/ui/use-action-runner";
import { fieldClass, labelClass } from "@/lib/ui/styles";

const PRIORITES = [
  { value: "normale", label: "Normale" },
  { value: "urgente", label: "Urgente" },
];


export function AnnouncementForm({
  announcement,
}: {
  announcement?: Announcement;
}) {
  const router = useRouter();
  const run = useActionRunner();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleAction(formData: FormData) {
    setError(null);
    if (announcement) {
      formData.set("id", announcement.id);
    }

    startTransition(async () => {
      const action = announcement ? updateAnnouncement : createAnnouncement;
      const result = await run(() => action(formData), {
        success: announcement ? "Annonce mise à jour" : "Annonce publiée",
        inline: true,
      });
      if (result?.error) setError(result.error);
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

      <FormFooter
        error={error}
        pending={pending}
        onCancel={() => router.back()}
      />
      </form>
  );
}
