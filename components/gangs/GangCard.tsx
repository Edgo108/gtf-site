import Link from "next/link";
import { DangerBadge } from "@/components/wanted/DangerBadge";
import type { Gang } from "@/lib/supabase/gangs-types";

export function GangCard({ gang }: { gang: Gang }) {
  return (
    <Link
      href={`/gangs/${gang.id}`}
      style={{ borderLeftColor: gang.couleur }}
      className="block rounded-md border border-l-4 border-gtf-border bg-gtf-panel p-4 transition-colors hover:border-gtf-blue"
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-display text-base font-semibold uppercase tracking-wide text-gtf-text">
          {gang.nom}
        </h2>
        <DangerBadge niveau={gang.niveau_menace} />
      </div>
      <p className="mt-2 text-sm text-gtf-text-muted">
        {gang.territoire || "Territoire inconnu"}
      </p>
    </Link>
  );
}
