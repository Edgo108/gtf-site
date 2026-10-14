"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { DangerBadge } from "@/components/wanted/DangerBadge";
import { CategorieBadge } from "@/components/gangs/CategorieBadge";
import { DealProduitBadge, DealStatutBadge } from "./DealPointBadges";
import type { Gang } from "@/lib/supabase/gangs-types";
import { TRASHED_ORGANISATION_LABEL } from "@/lib/supabase/gangs-types";
import type {
  DealPoint,
  DealPointHistoryEntry,
} from "@/lib/supabase/deal-points-types";
import { BADGE_TONES, badgeBase, btn } from "@/lib/ui/styles";
import { Spinner } from "@/components/ui/Spinner";
import { formatParisDateTime } from "@/lib/datetime";

export function DealPointDetailModal({
  point,
  gang,
  lockedByOther,
  onClose,
  onEdit,
  onDelete,
  editError,
  canWrite,
}: {
  point: DealPoint;
  // Organisation liée, null si aucune ou si elle est en corbeille.
  gang: Gang | null;
  lockedByOther: { pseudo: string } | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  editError: string | null;
  canWrite: boolean;
}) {
  const [history, setHistory] = useState<DealPointHistoryEntry[] | null>(null);
  const [historyError, setHistoryError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    createClient()
      .from("deal_point_history")
      .select("*")
      .eq("point_id", point.id)
      .order("created_at", { ascending: false })
      .returns<DealPointHistoryEntry[]>()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setHistoryError(true);
        setHistory(data ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [point.id]);

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-md border border-gtf-border bg-gtf-panel p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold uppercase tracking-wide text-gtf-text">
              Point de deal
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <DealProduitBadge produit={point.produit} />
              <DealStatutBadge statut={point.statut} />
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="-mr-2 -mt-1 shrink-0 px-2 py-1 text-2xl leading-none text-gtf-text-muted transition-colors hover:text-gtf-text"
          >
            ×
          </button>
        </div>

        <div className="mt-4 border-t border-gtf-border pt-4">
          <span className="font-mono text-xs uppercase tracking-wider text-gtf-text-muted">
            Organisation liée
          </span>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {gang ? (
              <>
                <span
                  className="h-6 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: gang.couleur }}
                  aria-hidden="true"
                />
                <Link
                  href={`/gangs/${gang.id}`}
                  className="font-display text-sm font-semibold uppercase tracking-wide text-gtf-blue-hover hover:underline"
                >
                  {gang.nom}
                </Link>
                <CategorieBadge categorie={gang.categorie} />
                <DangerBadge niveau={gang.niveau_menace} />
              </>
            ) : (
              <span className="text-sm text-gtf-text-muted">
                {point.organisation_id
                  ? TRASHED_ORGANISATION_LABEL
                  : "Aucune organisation"}
              </span>
            )}
          </div>
        </div>

        <div className="mt-4 border-t border-gtf-border pt-4">
          <span className="font-mono text-xs uppercase tracking-wider text-gtf-text-muted">
            Note
          </span>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm text-gtf-text">
            {point.note || <span className="text-gtf-text-muted">—</span>}
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {canWrite &&
            (lockedByOther ? (
              <span className={`${badgeBase} ${BADGE_TONES.amber}`}>
                Verrouillé par {lockedByOther.pseudo}
              </span>
            ) : (
              <button onClick={onEdit} className={btn("primary", "md")}>
                Modifier ce point
              </button>
            ))}
          {canWrite && (
            <button onClick={onDelete} className={btn("danger", "md")}>
              Supprimer ce point
            </button>
          )}
        </div>

        {editError && (
          <p role="alert" className="mt-2 text-xs text-gtf-red">
            {editError}
          </p>
        )}

        <div className="mt-5 border-t border-gtf-border pt-4">
          <h3 className="font-mono text-xs uppercase tracking-wider text-gtf-text-muted">
            Historique
          </h3>
          {history === null ? (
            <p className="mt-2 flex items-center gap-2 text-sm text-gtf-text-muted">
              <Spinner className="h-3 w-3 text-gtf-blue-hover" />
              Chargement…
            </p>
          ) : historyError ? (
            <p role="alert" className="mt-2 text-sm text-gtf-red">
              Impossible de charger l&apos;historique.
            </p>
          ) : history.length > 0 ? (
            <ul className="mt-2 flex flex-col gap-2">
              {history.map((entry) => (
                <li key={entry.id} className="border-l-2 border-gtf-border pl-3">
                  <p className="text-sm">{entry.resume}</p>
                  <p className="mt-0.5 font-mono text-xs text-gtf-text-muted">
                    {entry.agent_pseudo} · {formatParisDateTime(entry.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-gtf-text-muted">Aucun historique.</p>
          )}
        </div>
      </div>
    </div>
  );
}
