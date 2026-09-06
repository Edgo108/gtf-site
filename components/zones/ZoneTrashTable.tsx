"use client";

import { useState, useTransition } from "react";
import {
  restoreZone,
  permanentlyDeleteZone,
} from "@/app/(app)/admin/zones/corbeille/actions";
import type { Gang } from "@/lib/supabase/gangs-types";
import type { SensitiveZone } from "@/lib/supabase/zones-types";

const TYPE_LABELS = { vente: "Vente", influence: "Influence" } as const;

export function ZoneTrashTable({
  zones,
  gangsById,
}: {
  zones: SensitiveZone[];
  gangsById: Map<string, Gang>;
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-gtf-border">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gtf-border bg-gtf-panel-alt font-mono text-xs uppercase tracking-wider text-gtf-text-muted">
            <th className="px-4 py-3">Gang</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Supprimée le</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {zones.map((zone) => (
            <TrashRow
              key={zone.id}
              zone={zone}
              gangNom={gangsById.get(zone.gang_id)?.nom ?? "Gang inconnu"}
            />
          ))}
          {zones.length === 0 && (
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

function TrashRow({
  zone,
  gangNom,
}: {
  zone: SensitiveZone;
  gangNom: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleRestore() {
    setError(null);
    const formData = new FormData();
    formData.set("id", zone.id);

    startTransition(async () => {
      const result = await restoreZone(formData);
      if (result.error) setError(result.error);
    });
  }

  function handlePermanentDelete() {
    if (
      !window.confirm(
        `Supprimer définitivement cette zone (${gangNom}) ? Cette action est irréversible.`,
      )
    ) {
      return;
    }
    setError(null);
    const formData = new FormData();
    formData.set("id", zone.id);

    startTransition(async () => {
      const result = await permanentlyDeleteZone(formData);
      if (result.error) setError(result.error);
    });
  }

  return (
    <tr className="border-b border-gtf-border last:border-0">
      <td className="px-4 py-3">{gangNom}</td>
      <td className="px-4 py-3">{TYPE_LABELS[zone.type_zone]}</td>
      <td className="px-4 py-3 font-mono text-xs text-gtf-text-muted">
        {zone.deleted_at
          ? new Date(zone.deleted_at).toLocaleString("fr-FR")
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
