"use client";

import {
  restoreLabMarker,
  permanentlyDeleteLabMarker,
} from "@/app/(app)/admin/zones/corbeille/actions";
import { LabCategorieBadge, LabStatutBadge } from "@/components/zones/LabBadges";
import { TrashActions } from "@/components/ui/TrashActions";
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
      <table className="gtf-stack w-full text-left text-sm">
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
          {markers.map((marker) => {
            const orgNom =
              gangsById.get(marker.organisation_id)?.nom ??
              "Organisation inconnue";
            return (
              <tr
                key={marker.id}
                className="border-b border-gtf-border last:border-0"
              >
                <td data-label="Catégorie" className="px-4 py-3">
                  <LabCategorieBadge categorie={marker.categorie} />
                </td>
                <td data-label="Statut" className="px-4 py-3">
                  <LabStatutBadge statut={marker.statut} />
                </td>
                <td data-label="Organisation" className="px-4 py-3">
                  {orgNom}
                </td>
                <td
                  data-label="Supprimé le"
                  className="px-4 py-3 font-mono text-xs text-gtf-text-muted"
                >
                  {marker.deleted_at
                    ? new Date(marker.deleted_at).toLocaleString("fr-FR")
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  <TrashActions
                    id={marker.id}
                    restore={restoreLabMarker}
                    destroy={permanentlyDeleteLabMarker}
                    restoreSuccess="Marqueur laboratoire restauré"
                    destroySuccess="Marqueur laboratoire supprimé définitivement"
                    destroyConfirm={`Supprimer définitivement ce marqueur laboratoire (${orgNom}) ? Cette action est irréversible.`}
                  />
                </td>
              </tr>
            );
          })}
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
