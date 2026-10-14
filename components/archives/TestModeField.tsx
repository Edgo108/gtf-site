"use client";

import { TEST_MODE_EXPLANATION } from "@/lib/supabase/archives-types";
import { TestBadge } from "./TestBadge";

// Case « Mode test » des formulaires Rapport / Plainte. Modifiable
// uniquement à la création (`onChange` fourni) ; sur un document existant,
// le statut est affiché en lecture seule (la base refuse de toute façon
// de le changer).
export function TestModeField({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const box = checked
    ? "border-gtf-violet/60 bg-gtf-violet/10"
    : "border-gtf-border bg-gtf-panel-alt/50";

  if (!onChange) {
    return (
      <div className={`rounded-md border px-4 py-3 ${box}`}>
        <p className="flex flex-wrap items-center gap-2 font-mono text-xs uppercase tracking-wider text-gtf-text-muted">
          Type de document :
          {checked ? (
            <TestBadge />
          ) : (
            <span className="text-gtf-text">Officiel</span>
          )}
        </p>
        {checked && (
          <p className="mt-2 text-sm text-gtf-violet">{TEST_MODE_EXPLANATION}</p>
        )}
      </div>
    );
  }

  return (
    <div className={`rounded-md border px-4 py-3 transition-colors ${box}`}>
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          name="est_test"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-gtf-violet"
        />
        <span>
          <span className="flex flex-wrap items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wider text-gtf-text">
            Mode test
            {checked && <TestBadge />}
          </span>
          <span className="mt-1 block text-sm text-gtf-text-muted">
            {TEST_MODE_EXPLANATION}
          </span>
          <span className="mt-1 block font-mono text-[11px] text-gtf-text-muted">
            {checked
              ? "Numéro : TEST-XXX, attribué à l'enregistrement. Ce choix ne pourra plus être modifié."
              : "Numéro officiel attribué à l'enregistrement."}
          </span>
        </span>
      </label>
    </div>
  );
}
