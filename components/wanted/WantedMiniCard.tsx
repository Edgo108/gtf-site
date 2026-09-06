import Link from "next/link";
import { WantedPhoto } from "./WantedPhoto";
import { DangerBadge } from "./DangerBadge";
import type { WantedNotice } from "@/lib/supabase/wanted-notices-types";

// Version compacte de WantedCard, pour les vues d'ensemble (dashboard).
export function WantedMiniCard({ notice }: { notice: WantedNotice }) {
  return (
    <Link
      href={`/mandats/${notice.id}`}
      className="flex items-center gap-3 rounded-md border border-gtf-border bg-gtf-panel p-3 transition-colors hover:border-gtf-blue"
    >
      <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded">
        <WantedPhoto
          src={notice.photo_url}
          alt={notice.nom_suspect}
          className="absolute inset-0"
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="break-words font-display text-sm font-semibold uppercase tracking-wide text-gtf-text">
          {notice.nom_suspect}
        </p>
        <div className="mt-1.5">
          <DangerBadge niveau={notice.niveau_dangerosite} />
        </div>
      </div>
    </Link>
  );
}
