"use client";

import { useRef, useState, useTransition } from "react";
import { createAgent } from "@/app/(app)/admin/agents/actions";
import { GRADES } from "@/lib/constants";
import { UNITES, UNITE_LABELS } from "@/lib/permissions";

export function CreateAgentForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleAction(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createAgent({}, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      formRef.current?.reset();
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded bg-gtf-blue px-4 py-2 text-xs font-medium uppercase tracking-widest text-gtf-text transition-colors hover:bg-gtf-blue-hover"
      >
        Créer un agent
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={handleAction}
      className="flex flex-wrap items-end gap-4 rounded-md border border-gtf-border bg-gtf-panel-alt p-4"
    >
      <div>
        <label
          htmlFor="new-pseudo"
          className="mb-1 block font-mono text-xs uppercase tracking-wider text-gtf-text-muted"
        >
          Pseudo
        </label>
        <input
          id="new-pseudo"
          name="pseudo"
          type="text"
          required
          className="rounded border border-gtf-border bg-gtf-panel px-3 py-1.5 text-sm text-gtf-text focus:border-gtf-blue focus:outline-none"
        />
      </div>

      <div>
        <label
          htmlFor="new-password"
          className="mb-1 block font-mono text-xs uppercase tracking-wider text-gtf-text-muted"
        >
          Mot de passe temporaire
        </label>
        <input
          id="new-password"
          name="password"
          type="text"
          required
          minLength={8}
          className="rounded border border-gtf-border bg-gtf-panel px-3 py-1.5 text-sm text-gtf-text focus:border-gtf-blue focus:outline-none"
        />
      </div>

      <div>
        <label
          htmlFor="new-grade"
          className="mb-1 block font-mono text-xs uppercase tracking-wider text-gtf-text-muted"
        >
          Grade
        </label>
        <select
          id="new-grade"
          name="grade"
          required
          defaultValue={GRADES[0]}
          className="rounded border border-gtf-border bg-gtf-panel px-3 py-1.5 text-sm text-gtf-text focus:border-gtf-blue focus:outline-none"
        >
          {GRADES.map((grade) => (
            <option key={grade} value={grade}>
              {grade}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="new-unite"
          className="mb-1 block font-mono text-xs uppercase tracking-wider text-gtf-text-muted"
        >
          Unité
        </label>
        <select
          id="new-unite"
          name="unite"
          required
          defaultValue="SASP"
          className="rounded border border-gtf-border bg-gtf-panel px-3 py-1.5 text-sm text-gtf-text focus:border-gtf-blue focus:outline-none"
        >
          {UNITES.map((u) => (
            <option key={u} value={u}>
              {UNITE_LABELS[u]}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-gtf-blue px-4 py-2 text-xs font-medium uppercase tracking-widest text-gtf-text transition-colors hover:bg-gtf-blue-hover disabled:opacity-60"
      >
        {pending ? "..." : "Créer"}
      </button>

      <button
        type="button"
        onClick={() => setOpen(false)}
        className="rounded border border-gtf-border px-4 py-2 text-xs uppercase tracking-widest text-gtf-text-muted hover:text-gtf-text"
      >
        Annuler
      </button>

      {error && (
        <p role="alert" className="w-full text-xs text-gtf-red">
          {error}
        </p>
      )}
    </form>
  );
}
