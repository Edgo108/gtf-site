"use client";

import {
  permanentlyDeletePlainte,
  permanentlyDeleteRapport,
  restorePlainte,
  restoreRapport,
} from "@/app/(app)/admin/archives/corbeille/actions";
import { TrashActions } from "@/components/ui/TrashActions";
import { formatNumero } from "@/lib/supabase/archives-types";

export type ArchiveTrashRow = {
  id: string;
  numero: number;
  agentPseudo: string;
  personne: string;
  // Déjà formatée côté serveur (heure de Paris).
  deletedAt: string;
};

const KINDS = {
  rapport: {
    personneLabel: "Suspect",
    restore: restoreRapport,
    destroy: permanentlyDeleteRapport,
    restoreSuccess: "Rapport restauré",
    destroySuccess: "Rapport supprimé définitivement",
    confirm: (n: string) =>
      `Supprimer définitivement le rapport #${n} ? Cette action est irréversible.`,
  },
  plainte: {
    personneLabel: "Victime",
    restore: restorePlainte,
    destroy: permanentlyDeletePlainte,
    restoreSuccess: "Plainte restaurée",
    destroySuccess: "Plainte supprimée définitivement",
    confirm: (n: string) =>
      `Supprimer définitivement la plainte #${n} ? Cette action est irréversible.`,
  },
} as const;

export function ArchiveTrashTable({
  kind,
  rows,
}: {
  kind: keyof typeof KINDS;
  rows: ArchiveTrashRow[];
}) {
  const config = KINDS[kind];

  return (
    <div className="overflow-x-auto rounded-md border border-gtf-border">
      <table className="gtf-stack w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gtf-border bg-gtf-panel-alt font-mono text-xs uppercase tracking-wider text-gtf-text-muted">
            <th className="px-4 py-3">N°</th>
            <th className="px-4 py-3">Agent rédacteur</th>
            <th className="px-4 py-3">{config.personneLabel}</th>
            <th className="px-4 py-3">Supprimé le</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-gtf-border last:border-0">
              <td data-label="N°" className="px-4 py-3 font-mono">
                #{formatNumero(row.numero)}
              </td>
              <td data-label="Agent rédacteur" className="px-4 py-3">
                {row.agentPseudo}
              </td>
              <td data-label={config.personneLabel} className="px-4 py-3">
                {row.personne || "—"}
              </td>
              <td
                data-label="Supprimé le"
                className="px-4 py-3 font-mono text-xs text-gtf-text-muted"
              >
                {row.deletedAt}
              </td>
              <td className="px-4 py-3">
                <TrashActions
                  id={row.id}
                  restore={config.restore}
                  destroy={config.destroy}
                  restoreSuccess={config.restoreSuccess}
                  destroySuccess={config.destroySuccess}
                  destroyConfirm={config.confirm(formatNumero(row.numero))}
                />
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-center text-gtf-text-muted">
                Corbeille vide.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
