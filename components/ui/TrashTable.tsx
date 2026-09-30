import type { ReactNode } from "react";
import { TrashActions } from "@/components/ui/TrashActions";
import { formatParisDateTime } from "@/lib/datetime";

type Action = (formData: FormData) => Promise<{ error?: string } | void>;

export type TrashRow = {
  id: string;
  // Une cellule par colonne de `columns` (texte, badges…).
  cells: ReactNode[];
  deletedAt: string | null;
  // Nom repris dans la question de confirmation de suppression définitive.
  name: string;
};

// Tableau de corbeille commun à toutes les sections (réservé à l'admin) :
// colonnes propres à la section, puis « Supprimé le » et les boutons
// Restaurer / Supprimer définitivement. Composant serveur : les pages de
// corbeille construisent les lignes et passent leurs Server Actions.
export function TrashTable({
  columns,
  rows,
  restore,
  destroy,
  restoreSuccess,
  destroySuccess,
  destroyConfirm,
  destroyWarning,
  deletedLabel = "Supprimé le",
}: {
  columns: string[];
  rows: TrashRow[];
  restore: Action;
  destroy: Action;
  restoreSuccess: string;
  destroySuccess: string;
  // Début de la question, ex. « Supprimer définitivement le mandat ».
  destroyConfirm: string;
  // Précision ajoutée à la question (ce qui part avec la fiche…).
  destroyWarning?: string;
  deletedLabel?: string;
}) {
  const colSpan = columns.length + 2;

  return (
    <div className="overflow-x-auto rounded-md border border-gtf-border">
      <table className="gtf-stack w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gtf-border bg-gtf-panel-alt font-mono text-xs uppercase tracking-wider text-gtf-text-muted">
            {columns.map((label) => (
              <th key={label} className="px-4 py-3">
                {label}
              </th>
            ))}
            <th className="px-4 py-3">{deletedLabel}</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-gtf-border last:border-0">
              {row.cells.map((cell, i) => (
                <td key={columns[i]} data-label={columns[i]} className="px-4 py-3">
                  {cell}
                </td>
              ))}
              <td
                data-label={deletedLabel}
                className="px-4 py-3 font-mono text-xs text-gtf-text-muted"
              >
                {formatParisDateTime(row.deletedAt)}
              </td>
              <td className="px-4 py-3">
                <TrashActions
                  id={row.id}
                  restore={restore}
                  destroy={destroy}
                  restoreSuccess={restoreSuccess}
                  destroySuccess={destroySuccess}
                  destroyConfirm={`${destroyConfirm} « ${row.name} » ?${
                    destroyWarning ? ` ${destroyWarning}` : ""
                  } Cette action est irréversible.`}
                />
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={colSpan} className="px-4 py-6 text-center text-gtf-text-muted">
                Corbeille vide.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
