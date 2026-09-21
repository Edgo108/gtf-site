"use client";

import {
  restoreZone,
  permanentlyDeleteZone,
} from "@/app/(app)/admin/zones/corbeille/actions";
import { TrashActions } from "@/components/ui/TrashActions";
import type { Gang } from "@/lib/supabase/gangs-types";
import type { SensitiveZone } from "@/lib/supabase/zones-types";

const TYPE_LABELS = { vente: "Vente", qg: "QG" } as const;

export function ZoneTrashTable({
  zones,
  gangsById,
}: {
  zones: SensitiveZone[];
  gangsById: Map<string, Gang>;
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-gtf-border">
      <table className="gtf-stack w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gtf-border bg-gtf-panel-alt font-mono text-xs uppercase tracking-wider text-gtf-text-muted">
            <th className="px-4 py-3">Gang</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Supprimée le</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {zones.map((zone) => {
            const gangNom = gangsById.get(zone.gang_id)?.nom ?? "Gang inconnu";
            return (
              <tr key={zone.id} className="border-b border-gtf-border last:border-0">
                <td data-label="Gang" className="px-4 py-3">
                  {gangNom}
                </td>
                <td data-label="Type" className="px-4 py-3">
                  {TYPE_LABELS[zone.type_zone]}
                </td>
                <td
                  data-label="Supprimée le"
                  className="px-4 py-3 font-mono text-xs text-gtf-text-muted"
                >
                  {zone.deleted_at
                    ? new Date(zone.deleted_at).toLocaleString("fr-FR")
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  <TrashActions
                    id={zone.id}
                    restore={restoreZone}
                    destroy={permanentlyDeleteZone}
                    restoreSuccess="Zone restaurée"
                    destroySuccess="Zone supprimée définitivement"
                    destroyConfirm={`Supprimer définitivement cette zone (${gangNom}) ? Cette action est irréversible.`}
                  />
                </td>
              </tr>
            );
          })}
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
