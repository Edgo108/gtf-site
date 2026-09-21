"use client";

import {
  restoreGang,
  permanentlyDeleteGang,
} from "@/app/(app)/admin/gangs/corbeille/actions";
import { CategorieBadge } from "@/components/gangs/CategorieBadge";
import { TrashActions } from "@/components/ui/TrashActions";
import type { Gang } from "@/lib/supabase/gangs-types";

export function GangTrashTable({ gangs }: { gangs: Gang[] }) {
  return (
    <div className="overflow-x-auto rounded-md border border-gtf-border">
      <table className="gtf-stack w-full text-left text-sm">
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
            <tr key={gang.id} className="border-b border-gtf-border last:border-0">
              <td data-label="Nom" className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <CategorieBadge categorie={gang.categorie} />
                  <span>{gang.nom}</span>
                </div>
              </td>
              <td data-label="Territoire" className="px-4 py-3">
                {gang.territoire || "—"}
              </td>
              <td
                data-label="Supprimé le"
                className="px-4 py-3 font-mono text-xs text-gtf-text-muted"
              >
                {gang.deleted_at
                  ? new Date(gang.deleted_at).toLocaleString("fr-FR")
                  : "—"}
              </td>
              <td className="px-4 py-3">
                <TrashActions
                  id={gang.id}
                  restore={restoreGang}
                  destroy={permanentlyDeleteGang}
                  restoreSuccess="Fiche B.D.D restaurée"
                  destroySuccess="Fiche B.D.D supprimée définitivement"
                  destroyConfirm={`Supprimer définitivement "${gang.nom}" ? Cette action est irréversible.`}
                />
              </td>
            </tr>
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
