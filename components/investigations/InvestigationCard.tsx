import Link from "next/link";
import { StatutBadge } from "./StatutBadge";
import type { Investigation } from "@/lib/supabase/investigations-types";

export function InvestigationCard({
  investigation,
}: {
  investigation: Investigation;
}) {
  return (
    <Link
      href={`/enquetes/${investigation.id}`}
      className="block rounded-md border border-gtf-border bg-gtf-panel p-4 transition-colors hover:border-gtf-blue"
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-display text-base font-semibold uppercase tracking-wide text-gtf-text">
          {investigation.titre}
        </h2>
        <StatutBadge statut={investigation.statut} />
      </div>
      <p className="mt-2 line-clamp-2 text-sm text-gtf-text-muted">
        {investigation.suspects || "Aucun suspect renseigné"}
      </p>
      <p className="mt-3 font-mono text-xs text-gtf-text-muted">
        Responsable : {investigation.agent_responsable || "—"}
      </p>
    </Link>
  );
}
