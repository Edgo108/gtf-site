"use client";

import { useState, useTransition } from "react";
import {
  restoreGang,
  permanentlyDeleteGang,
} from "@/app/(app)/admin/gangs/corbeille/actions";
import { CategorieBadge } from "@/components/gangs/CategorieBadge";
import type { Gang } from "@/lib/supabase/gangs-types";

export function GangTrashTable({ gangs }: { gangs: Gang[] }) {
  return (
    <div className="overflow-x-auto rounded-md border border-gtf-border">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gtf-border bg-gtf-panel-alt font-mono text-xs uppercase tracking-wider text-gtf-text-muted">
            <th className="px-4 py-3">Nom</th>
            <th className="px-4 py-3">Territoire</th>
            <th className="px-4 py-3">Supprimé le</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {gangs.map((gang) => (
            <TrashRow key={gang.id} gang={gang} />
          ))}
          {gangs.length === 0 && (
            <tr>
              <td
                colSpan={4}
                className="px-4 py-6 text-center text-gtf-text-muted"
              >
                Corbeille vide.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function TrashRow({ gang }: { gang: Gang }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleRestore() {
    setError(null);
    const formData = new FormData();
    formData.set("id", gang.id);

    startTransition(async () => {
      const result = await restoreGang(formData);
      if (result.error) setError(result.error);
    });
  }

  function handlePermanentDelete() {
    if (
      !window.confirm(
        `Supprimer définitivement "${gang.nom}" ? Cette action est irréversible.`,
      )
    ) {
      return;
    }
    setError(null);
    const formData = new FormData();
    formData.set("id", gang.id);

    startTransition(async () => {
      const result = await permanentlyDeleteGang(formData);
      if (result.error) setError(result.error);
    });
  }

  return (
    <tr className="border-b border-gtf-border last:border-0">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <CategorieBadge categorie={gang.categorie} />
          <span>{gang.nom}</span>
        </div>
      </td>
      <td className="px-4 py-3">{gang.territoire || "—"}</td>
      <td className="px-4 py-3 font-mono text-xs text-gtf-text-muted">
        {gang.deleted_at
          ? new Date(gang.deleted_at).toLocaleString("fr-FR")
          : "—"}
      </td>
      <td className="px-4 py-3">
        <div className="flex justify-end gap-2">
          <button
            onClick={handleRestore}
            disabled={pending}
            className="rounded border border-gtf-green px-3 py-1 text-xs uppercase tracking-wider text-gtf-green hover:bg-gtf-green/10 disabled:opacity-60"
          >
            Restaurer
          </button>
          <button
            onClick={handlePermanentDelete}
            disabled={pending}
            className="rounded border border-gtf-red px-3 py-1 text-xs uppercase tracking-wider text-gtf-red hover:bg-gtf-red/10 disabled:opacity-60"
          >
            Supprimer définitivement
          </button>
        </div>
        {error && (
          <p role="alert" className="mt-1 text-right text-xs text-gtf-red">
            {error}
          </p>
        )}
      </td>
    </tr>
  );
}
