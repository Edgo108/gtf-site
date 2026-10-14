"use client";

import type { Gang } from "@/lib/supabase/gangs-types";
import {
  DEAL_PRODUIT_OPTIONS,
  DEAL_STATUT_OPTIONS,
  type DealProduit,
  type DealStatut,
} from "@/lib/supabase/deal-points-types";
import { TEXT_LIMITS } from "@/lib/limits";
import { btn, fieldCompactClass } from "@/lib/ui/styles";

export type DealPointDraft = {
  produit: DealProduit;
  statut: DealStatut;
  organisationId: string;
  note: string;
};

export const EMPTY_DEAL_DRAFT: DealPointDraft = {
  produit: "cocaine",
  statut: "actif",
  organisationId: "",
  note: "",
};

const labelClass =
  "mb-1 block font-mono text-[10px] uppercase tracking-wider text-gtf-text-muted";
const selectClass = `w-full ${fieldCompactClass}`;

// Panneau de la carte pour créer ou modifier un point de deal (produit,
// statut, organisation facultative, note). La position se choisit sur la
// carte : clic (création) ou glisser-déposer (modification).
export function DealPointFormPanel({
  title,
  draft,
  onChange,
  gangs,
  hint,
  submitLabel,
  onSubmit,
  onCancel,
  pending,
  error,
}: {
  title: string;
  draft: DealPointDraft;
  onChange: (draft: DealPointDraft) => void;
  gangs: Gang[];
  hint: string;
  submitLabel: string;
  onSubmit: () => void;
  onCancel: () => void;
  pending: boolean;
  error: string | null;
}) {
  const set = <K extends keyof DealPointDraft>(key: K, value: DealPointDraft[K]) =>
    onChange({ ...draft, [key]: value });

  return (
    <div className="max-h-[55dvh] w-full overflow-y-auto rounded-md border border-gtf-border bg-gtf-panel/95 p-3 shadow-lg sm:max-h-[calc(75dvh-1.5rem)] sm:w-72">
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-gtf-text">
        {title}
      </p>
      <div className="mt-2">
        <label className={labelClass}>Produit</label>
        <select
          value={draft.produit}
          onChange={(e) => set("produit", e.target.value as DealProduit)}
          className={selectClass}
        >
          {DEAL_PRODUIT_OPTIONS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-2">
        <label className={labelClass}>Statut</label>
        <select
          value={draft.statut}
          onChange={(e) => set("statut", e.target.value as DealStatut)}
          className={selectClass}
        >
          {DEAL_STATUT_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-2">
        <label className={labelClass}>Organisation (facultatif)</label>
        <select
          value={draft.organisationId}
          onChange={(e) => set("organisationId", e.target.value)}
          className={selectClass}
        >
          <option value="">Aucune organisation</option>
          {gangs.map((g) => (
            <option key={g.id} value={g.id}>
              {g.nom}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-2">
        <label className={labelClass}>Note</label>
        <textarea
          value={draft.note}
          onChange={(e) => set("note", e.target.value)}
          rows={3}
          maxLength={TEXT_LIMITS.deal_points.note}
          className={selectClass}
        />
      </div>
      <p className="mt-2 font-mono text-[11px] text-gtf-text-muted">{hint}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={onSubmit} disabled={pending} className={btn("primary", "sm")}>
          {pending ? "..." : submitLabel}
        </button>
        <button onClick={onCancel} className={btn("secondary", "sm")}>
          Annuler
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-xs text-gtf-red">
          {error}
        </p>
      )}
    </div>
  );
}
