import Link from "next/link";
import { formatNumero } from "@/lib/supabase/archives-types";
import { formatParisDateTime } from "@/lib/datetime";

export type ArchiveListRow = {
  id: string;
  numero: number;
  date_redaction: string;
  agentPseudo: string;
  // Nom du suspect (rapport) ou de la victime (plainte).
  personne: string;
};

// Liste des Rapports / Plaintes : n°, date de rédaction, agent rédacteur,
// suspect ou victime. Chaque ligne mène à la fiche détaillée.
export function ArchiveListTable({
  rows,
  basePath,
  personneLabel,
  emptyLabel,
}: {
  rows: ArchiveListRow[];
  basePath: string;
  personneLabel: string;
  emptyLabel: string;
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-gtf-border bg-gtf-panel">
      <table className="gtf-stack w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gtf-border bg-gtf-panel-alt font-mono text-xs uppercase tracking-wider text-gtf-text-muted">
            <th className="px-4 py-3">N°</th>
            <th className="px-4 py-3">Rédigé le</th>
            <th className="px-4 py-3">Agent rédacteur</th>
            <th className="px-4 py-3">{personneLabel}</th>
            <th className="px-4 py-3 text-right">
              <span className="sr-only">Ouvrir</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="border-b border-gtf-border transition-colors last:border-0 hover:bg-gtf-panel-alt/60"
            >
              <td data-label="N°" className="px-4 py-3">
                <Link
                  href={`${basePath}/${row.id}`}
                  className="font-mono font-semibold text-gtf-blue-hover hover:underline"
                >
                  #{formatNumero(row.numero)}
                </Link>
              </td>
              <td
                data-label="Rédigé le"
                className="px-4 py-3 font-mono text-xs text-gtf-text-muted"
              >
                {formatParisDateTime(row.date_redaction)}
              </td>
              <td data-label="Agent rédacteur" className="px-4 py-3">
                {row.agentPseudo}
              </td>
              <td data-label={personneLabel} className="px-4 py-3">
                {row.personne || (
                  <span className="text-gtf-text-muted">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={`${basePath}/${row.id}`}
                  className="font-mono text-xs uppercase tracking-wider text-gtf-blue-hover hover:underline"
                >
                  Consulter →
                </Link>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={5}
                className="px-4 py-6 text-center text-gtf-text-muted"
              >
                {emptyLabel}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
