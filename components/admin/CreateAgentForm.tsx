"use client";

import { useRef, useState, useTransition } from "react";
import { createAgent } from "@/app/(app)/admin/agents/actions";
import { GRADES } from "@/lib/constants";
import { UNITES, UNITE_LABELS } from "@/lib/permissions";
import { Spinner } from "@/components/ui/Spinner";
import { useActionRunner } from "@/lib/ui/use-action-runner";
import { btn, inputBase, labelClass } from "@/lib/ui/styles";

export function CreateAgentForm() {
  const run = useActionRunner();
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleAction(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await run(() => createAgent({}, formData), {
        success: "Agent créé",
        inline: true,
      });
      if (result?.error) {
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
        className={btn("primary")}
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
      <div className="w-full sm:w-auto">
        <label
          htmlFor="new-pseudo"
          className={labelClass}
        >
          Pseudo
        </label>
        <input
          id="new-pseudo"
          name="pseudo"
          type="text"
          required
          className={`${inputBase} w-full sm:w-auto`}
        />
      </div>

      <div className="w-full sm:w-auto">
        <label
          htmlFor="new-password"
          className={labelClass}
        >
          Mot de passe temporaire
        </label>
        <input
          id="new-password"
          name="password"
          type="text"
          required
          minLength={8}
          className={`${inputBase} w-full sm:w-auto`}
        />
      </div>

      <div className="w-full sm:w-auto">
        <label
          htmlFor="new-grade"
          className={labelClass}
        >
          Grade
        </label>
        <select
          id="new-grade"
          name="grade"
          required
          defaultValue={GRADES[0]}
          className={`${inputBase} w-full sm:w-auto`}
        >
          {GRADES.map((grade) => (
            <option key={grade} value={grade}>
              {grade}
            </option>
          ))}
        </select>
      </div>

      <div className="w-full sm:w-auto">
        <label
          htmlFor="new-unite"
          className={labelClass}
        >
          Unité
        </label>
        <select
          id="new-unite"
          name="unite"
          required
          defaultValue="SASP"
          className={`${inputBase} w-full sm:w-auto`}
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
        aria-busy={pending}
        className={btn("primary")}
      >
        {pending && <Spinner className="h-3 w-3" />}
        Créer
      </button>

      <button
        type="button"
        onClick={() => setOpen(false)}
        disabled={pending}
        className={btn("secondary")}
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
