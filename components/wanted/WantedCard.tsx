import Link from "next/link";
import { WantedPhoto } from "./WantedPhoto";
import { StatutRibbon } from "./StatutRibbon";
import { DangerBadge } from "./DangerBadge";
import type { WantedNotice } from "@/lib/supabase/wanted-notices-types";

export function WantedCard({ notice }: { notice: WantedNotice }) {
  return (
    <Link
      href={`/mandats/${notice.id}`}
      className="block overflow-hidden rounded-md border border-gtf-border bg-gtf-panel transition-colors hover:border-gtf-blue"
    >
      <div className="relative aspect-[3/4] overflow-hidden">
        <WantedPhoto
          src={notice.photo_url}
          alt={notice.nom_suspect}
          className="absolute inset-0"
        />
        <StatutRibbon statut={notice.statut} />
      </div>
      <div className="p-3">
        <h2 className="truncate font-display text-base font-semibold uppercase tracking-wide text-gtf-text">
          {notice.nom_suspect}
        </h2>
        <div className="mt-2">
          <DangerBadge niveau={notice.niveau_dangerosite} />
        </div>
      </div>
    </Link>
  );
}
