"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { DangerBadge } from "@/components/wanted/DangerBadge";
import type { Gang } from "@/lib/supabase/gangs-types";
import type {
  SensitiveZone,
  ZoneHistoryEntry,
} from "@/lib/supabase/zones-types";
import { BADGE_TONES, badgeBase, btn } from "@/lib/ui/styles";
import { Spinner } from "@/components/ui/Spinner";

const TYPE_LABELS = { vente: "Vente", qg: "QG" } as const;

export function ZoneDetailModal({
  zone,
  gang,
  lockedByOther,
  onClose,
  onEdit,
  onDelete,
  editError,
  canWrite,
}: {
  zone: SensitiveZone;
  gang: Gang | null;
  lockedByOther: { pseudo: string } | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  editError: string | null;
  canWrite: boolean;
}) {
  const [history, setHistory] = useState<ZoneHistoryEntry[] | null>(null);
  const [historyError, setHistoryError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    supabase
      .from("zone_history")
      .select("*")
      .eq("zone_id", zone.id)
      .order("created_at", { ascending: false })
      .returns<ZoneHistoryEntry[]>()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setHistoryError(true);
        setHistory(data ?? []);
      });

    return () => {
      cancelled = true;
    };
  }, [zone.id]);

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
          <div className="flex items-center gap-3">
            {gang && (
              <span
                className="h-8 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: gang.couleur }}
                aria-hidden="true"
              />
            )}
            <div>
              <h2 className="font-display text-xl font-bold uppercase tracking-wide text-gtf-text">
                {gang ? gang.nom : "Gang inconnu"}
              </h2>
              {gang && (
                <div className="mt-1 flex items-center gap-2">
                  <DangerBadge niveau={gang.niveau_menace} />
                  <span className="font-mono text-xs text-gtf-text-muted">
                    {gang.territoire || "Territoire inconnu"}
                  </span>
                </div>
              )}
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

        {gang && (
          <p className="mt-4 whitespace-pre-wrap text-sm text-gtf-text">
            {gang.activites || "—"}
          </p>
        )}

        <div className="mt-4 flex items-center gap-2 border-t border-gtf-border pt-4">
          <span className="font-mono text-xs uppercase tracking-wider text-gtf-text-muted">
            Type de zone :
          </span>
          <span
            className={`${badgeBase} ${zone.type_zone === "vente" ? BADGE_TONES.blue : BADGE_TONES.muted}`}
          >
            {TYPE_LABELS[zone.type_zone]}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {canWrite &&
            (lockedByOther ? (
              <span className={`${badgeBase} ${BADGE_TONES.amber}`}>
                Verrouillée par {lockedByOther.pseudo}
              </span>
            ) : (
              <button
                onClick={onEdit}
                className={btn("primary", "md")}
              >
                Modifier cette zone
              </button>
            ))}
          {canWrite && (
            <button
              onClick={onDelete}
              className={btn("danger", "md")}
            >
              Supprimer cette zone
            </button>
          )}
          {gang && (
            <Link
              href={`/gangs/${gang.id}`}
              className={btn("secondary", "md")}
            >
              Voir la fiche complète
            </Link>
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
                <li
                  key={entry.id}
                  className="border-l-2 border-gtf-border pl-3"
                >
                  <p className="text-sm">{entry.resume}</p>
                  <p className="mt-0.5 font-mono text-xs text-gtf-text-muted">
                    {entry.agent_pseudo} ·{" "}
                    {new Date(entry.created_at).toLocaleString("fr-FR")}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-gtf-text-muted">
              Aucun historique.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
