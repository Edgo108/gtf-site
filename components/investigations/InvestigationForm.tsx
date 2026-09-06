"use client";

import { useState, useTransition, type FocusEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  createInvestigation,
  updateInvestigation,
  checkSuspectMatches,
} from "@/app/(app)/enquetes/actions";
import { parseSuspectNames, type SuspectMatch } from "@/lib/investigations/suspects";
import type { Investigation } from "@/lib/supabase/investigations-types";

const STATUTS: { value: Investigation["statut"]; label: string }[] = [
  { value: "en_cours", label: "En cours" },
  { value: "cloturee", label: "Clôturée" },
  { value: "archivee", label: "Archivée" },
];

const fieldClass =
  "w-full rounded border border-gtf-border bg-gtf-panel-alt px-3 py-2 text-sm text-gtf-text focus:border-gtf-blue focus:outline-none";
const labelClass =
  "mb-1 block font-mono text-xs uppercase tracking-wider text-gtf-text-muted";

export function InvestigationForm({
  investigation,
}: {
  investigation?: Investigation;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [suspectMatches, setSuspectMatches] = useState<SuspectMatch[]>([]);
  const [lastChecked, setLastChecked] = useState(investigation?.suspects ?? "");

  function handleAction(formData: FormData) {
    setError(null);
    if (investigation) {
      formData.set("id", investigation.id);
    }

    startTransition(async () => {
      const action = investigation ? updateInvestigation : createInvestigation;
      const result = await action(formData);
      if (result?.error) {
        setError(result.error);
      }
    });
  }

  async function handleSuspectsBlur(event: FocusEvent<HTMLTextAreaElement>) {
    const value = event.target.value;
    if (value === lastChecked) return;
    setLastChecked(value);

    const names = parseSuspectNames(value);
    if (names.length === 0) {
      setSuspectMatches([]);
      return;
    }

    const results = await checkSuspectMatches(names, investigation?.id);
    setSuspectMatches(results);
  }

  function dismissMatch(name: string) {
    setSuspectMatches((current) => current.filter((m) => m.name !== name));
  }

  return (
    <>
      <div className="fixed right-4 top-4 z-50 flex flex-col gap-2">
        {suspectMatches.map((match) => (
          <div
            key={match.name}
            role="alert"
            className="w-80 rounded-md border border-gtf-amber bg-gtf-panel p-3 shadow-lg"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm text-gtf-text">
                Suspect « {match.name} » détecté dans{" "}
                {match.investigations.length} enquête
                {match.investigations.length > 1 ? "s" : ""} différente
                {match.investigations.length > 1 ? "s" : ""} :
              </p>
              <button
                onClick={() => dismissMatch(match.name)}
                aria-label="Fermer"
                className="shrink-0 text-gtf-text-muted hover:text-gtf-text"
              >
                ×
              </button>
            </div>
            <ul className="mt-2 flex flex-col gap-1">
              {match.investigations.map((inv) => (
                <li key={inv.id}>
                  <Link
                    href={`/enquetes/${inv.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-gtf-blue-hover underline"
                  >
                    {inv.titre}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <form action={handleAction} className="flex flex-col gap-5">
      <div>
        <label htmlFor="titre" className={labelClass}>
          Titre
        </label>
        <input
          id="titre"
          name="titre"
          type="text"
          required
          defaultValue={investigation?.titre}
          className={fieldClass}
        />
      </div>

      <div>
        <label htmlFor="statut" className={labelClass}>
          Statut
        </label>
        <select
          id="statut"
          name="statut"
          defaultValue={investigation?.statut ?? "en_cours"}
          className={fieldClass}
        >
          {STATUTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="agent_responsable" className={labelClass}>
          Agent responsable
        </label>
        <input
          id="agent_responsable"
          name="agent_responsable"
          type="text"
          defaultValue={investigation?.agent_responsable}
          className={fieldClass}
        />
      </div>

      <div>
        <label htmlFor="suspects" className={labelClass}>
          Suspects
        </label>
        <textarea
          id="suspects"
          name="suspects"
          rows={2}
          defaultValue={investigation?.suspects}
          onBlur={handleSuspectsBlur}
          className={fieldClass}
        />
        <p className="mt-1 font-mono text-[11px] text-gtf-text-muted">
          Séparez les noms par une virgule ou un retour à la ligne.
        </p>
      </div>

      <div>
        <label htmlFor="description" className={labelClass}>
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          defaultValue={investigation?.description}
          className={fieldClass}
        />
      </div>

      <div>
        <label htmlFor="preuves" className={labelClass}>
          Preuves
        </label>
        <textarea
          id="preuves"
          name="preuves"
          rows={4}
          defaultValue={investigation?.preuves}
          className={fieldClass}
        />
      </div>

      {error && (
        <p role="alert" className="text-xs text-gtf-red">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-gtf-blue px-5 py-2 text-xs font-medium uppercase tracking-widest text-gtf-text transition-colors hover:bg-gtf-blue-hover disabled:opacity-60"
        >
          {pending ? "..." : "Enregistrer"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded border border-gtf-border px-5 py-2 text-xs uppercase tracking-widest text-gtf-text-muted hover:text-gtf-text"
        >
          Annuler
        </button>
      </div>
      </form>
    </>
  );
}
