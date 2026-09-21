"use client";

import {
  restoreInvestigation,
  permanentlyDeleteInvestigation,
} from "@/app/(app)/admin/enquetes/corbeille/actions";
import { TrashActions } from "@/components/ui/TrashActions";
import type { Investigation } from "@/lib/supabase/investigations-types";

export function TrashTable({
  investigations,
}: {
  investigations: Investigation[];
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-gtf-border">
      <table className="gtf-stack w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gtf-border bg-gtf-panel-alt font-mono text-xs uppercase tracking-wider text-gtf-text-muted">
            <th className="px-4 py-3">Titre</th>
            <th className="px-4 py-3">Agent responsable</th>
            <th className="px-4 py-3">Supprimée le</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {investigations.map((investigation) => (
            <tr
              key={investigation.id}
              className="border-b border-gtf-border last:border-0"
            >
              <td data-label="Titre" className="px-4 py-3">
                {investigation.titre}
              </td>
              <td data-label="Agent responsable" className="px-4 py-3">
                {investigation.agent_responsable || "—"}
              </td>
              <td
                data-label="Supprimée le"
                className="px-4 py-3 font-mono text-xs text-gtf-text-muted"
              >
                {investigation.deleted_at
                  ? new Date(investigation.deleted_at).toLocaleString("fr-FR")
                  : "—"}
              </td>
              <td className="px-4 py-3">
                <TrashActions
                  id={investigation.id}
                  restore={restoreInvestigation}
                  destroy={permanentlyDeleteInvestigation}
                  restoreSuccess="Enquête restaurée"
                  destroySuccess="Enquête supprimée définitivement"
                  destroyConfirm={`Supprimer définitivement "${investigation.titre}" ? Cette action est irréversible.`}
                />
              </td>
            </tr>
          ))}
          {investigations.length === 0 && (
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
