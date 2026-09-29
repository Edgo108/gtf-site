import Link from "next/link";
import { OperationStatutBadge } from "./OperationStatutBadge";
import type { OperationListRow } from "@/lib/supabase/operations-types";

// Cliquable uniquement pour les utilisateurs autorisés (admin / lead /
// agent en écriture) : pour les autres, la carte reste visible (titre,
// statut, pseudo du lead) mais non cliquable.
export function OperationCard({
  operation,
  clickable,
}: {
  operation: OperationListRow;
  clickable: boolean;
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <h2 className="min-w-0 break-words font-display text-base font-semibold uppercase tracking-wide text-gtf-text">
          {operation.titre}
        </h2>
        <OperationStatutBadge statut={operation.statut} />
      </div>
      <p className="mt-3 font-mono text-xs text-gtf-text-muted">
        Lead : {operation.lead_pseudo}
      </p>
    </>
  );

  if (!clickable) {
    return (
      <div
        aria-disabled="true"
        className="cursor-not-allowed rounded-md border border-gtf-border bg-gtf-panel p-4 opacity-60"
      >
        {content}
      </div>
    );
  }

  return (
    <Link
      href={`/operations/${operation.id}`}
      className="block rounded-md border border-gtf-border bg-gtf-panel p-4 transition-colors hover:border-gtf-blue"
    >
      {content}
    </Link>
  );
}
