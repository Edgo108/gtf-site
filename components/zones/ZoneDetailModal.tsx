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

const TYPE_LABELS = { vente: "Vente", influence: "Influence" } as const;

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

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    supabase
      .from("zone_history")
      .select("*")
      .eq("zone_id", zone.id)
      .order("created_at", { ascending: false })
      .returns<ZoneHistoryEntry[]>()
      .then(({ data }) => {
        if (!cancelled) setHistory(data ?? []);
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
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-md border border-gtf-border bg-gtf-panel p-5"
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
            className="shrink-0 text-gtf-text-muted hover:text-gtf-text"
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
            className={`rounded border px-2 py-0.5 font-mono text-xs uppercase tracking-wider ${
              zone.type_zone === "vente"
                ? "border-gtf-blue text-gtf-blue-hover"
                : "border-gtf-text-muted text-gtf-text-muted"
            }`}
          >
            {TYPE_LABELS[zone.type_zone]}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {canWrite &&
            (lockedByOther ? (
              <span className="rounded border border-gtf-amber bg-gtf-amber/10 px-3 py-2 text-xs uppercase tracking-widest text-gtf-amber">
                Verrouillée par {lockedByOther.pseudo}
              </span>
            ) : (
              <button
                onClick={onEdit}
                className="rounded bg-gtf-blue px-4 py-2 text-xs uppercase tracking-widest text-gtf-text hover:bg-gtf-blue-hover"
              >
                Modifier cette zone
              </button>
            ))}
          {canWrite && (
            <button
              onClick={onDelete}
              className="rounded border border-gtf-red px-4 py-2 text-xs uppercase tracking-widest text-gtf-red hover:bg-gtf-red/10"
            >
              Supprimer cette zone
            </button>
          )}
          {gang && (
            <Link
              href={`/gangs/${gang.id}`}
              className="rounded border border-gtf-border px-4 py-2 text-xs uppercase tracking-widest text-gtf-text-muted hover:text-gtf-text"
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
            <p className="mt-2 text-sm text-gtf-text-muted">Chargement…</p>
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
