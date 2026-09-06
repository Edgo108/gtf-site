"use client";

import { useState, useTransition } from "react";
import { toggleWantedStatut } from "@/app/(app)/mandats/actions";
import type { WantedStatut } from "@/lib/supabase/wanted-notices-types";

export function MarkCapturedButton({
  id,
  statut,
}: {
  id: string;
  statut: WantedStatut;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    const formData = new FormData();
    formData.set("id", id);
    formData.set("statut", statut);

    startTransition(async () => {
      const result = await toggleWantedStatut(formData);
      if (result?.error) setError(result.error);
    });
  }

  const isActif = statut === "actif";

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={pending}
        className={`rounded border px-4 py-2 text-xs uppercase tracking-widest disabled:opacity-60 ${
          isActif
            ? "border-gtf-green text-gtf-green hover:bg-gtf-green/10"
            : "border-gtf-red text-gtf-red hover:bg-gtf-red/10"
        }`}
      >
        {isActif ? "Marquer comme capturé" : "Marquer comme actif"}
      </button>
      {error && (
        <p role="alert" className="mt-1 text-xs text-gtf-red">
          {error}
        </p>
      )}
    </div>
  );
}
