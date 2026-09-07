"use client";

import { useState, useTransition } from "react";
import {
  restoreLabMarker,
  permanentlyDeleteLabMarker,
} from "@/app/(app)/admin/zones/corbeille/actions";
import { LabCategorieBadge, LabStatutBadge } from "@/components/zones/LabBadges";
import type { Gang } from "@/lib/supabase/gangs-types";
import type { LabMarker } from "@/lib/supabase/lab-markers-types";

export function LabMarkerTrashTable({
  markers,
  gangsById,
}: {
  markers: LabMarker[];
  gangsById: Map<string, Gang>;
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-gtf-border">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gtf-border bg-gtf-panel-alt font-mono text-xs uppercase tracking-wider text-gtf-text-muted">
            <th className="px-4 py-3">Catégorie</th>
            <th className="px-4 py-3">Statut</th>
            <th className="px-4 py-3">Organisation</th>
            <th className="px-4 py-3">Supprimé le</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {markers.map((marker) => (
            <TrashRow
              key={marker.id}
              marker={marker}
              orgNom={
                gangsById.get(marker.organisation_id)?.nom ??
                "Organisation inconnue"
              }
            />
          ))}
          {markers.length === 0 && (
            <tr>
              <td
                colSpan={5}
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

function TrashRow({
  marker,
  orgNom,
}: {
  marker: LabMarker;
  orgNom: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleRestore() {
    setError(null);
    const formData = new FormData();
    formData.set("id", marker.id);

    startTransition(async () => {
      const result = await restoreLabMarker(formData);
      if (result.error) setError(result.error);
    });
  }

  function handlePermanentDelete() {
    if (
      !window.confirm(
        `Supprimer définitivement ce marqueur laboratoire (${orgNom}) ? Cette action est irréversible.`,
      )
    ) {
      return;
    }
    setError(null);
    const formData = new FormData();
    formData.set("id", marker.id);

    startTransition(async () => {
      const result = await permanentlyDeleteLabMarker(formData);
      if (result.error) setError(result.error);
    });
  }

  return (
    <tr className="border-b border-gtf-border last:border-0">
      <td className="px-4 py-3">
        <LabCategorieBadge categorie={marker.categorie} />
      </td>
      <td className="px-4 py-3">
        <LabStatutBadge statut={marker.statut} />
      </td>
      <td className="px-4 py-3">{orgNom}</td>
      <td className="px-4 py-3 font-mono text-xs text-gtf-text-muted">
        {marker.deleted_at
          ? new Date(marker.deleted_at).toLocaleString("fr-FR")
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
