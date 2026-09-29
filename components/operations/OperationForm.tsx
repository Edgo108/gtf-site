"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createOperation, updateOperation } from "@/app/(app)/operations/actions";
import { OPERATION_STATUT_OPTIONS } from "@/lib/supabase/operations-types";
import type { Operation } from "@/lib/supabase/operations-types";
import { FormFooter } from "@/components/ui/FormFooter";
import { useActionRunner } from "@/lib/ui/use-action-runner";
import { fieldClass, labelClass } from "@/lib/ui/styles";

export function OperationForm({ operation }: { operation?: Operation }) {
  const router = useRouter();
  const run = useActionRunner();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleAction(formData: FormData) {
    setError(null);
    if (operation) {
      formData.set("id", operation.id);
    }

    startTransition(async () => {
      const action = operation ? updateOperation : createOperation;
      const result = await run(() => action(formData), {
        success: operation ? "Opération mise à jour" : "Opération créée",
        inline: true,
      });
      if (result?.error) setError(result.error);
    });
  }

  return (
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
          defaultValue={operation?.titre}
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
          defaultValue={operation?.statut ?? "en_cours"}
          className={fieldClass}
        >
          {OPERATION_STATUT_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="description" className={labelClass}>
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={6}
          defaultValue={operation?.description}
          className={fieldClass}
        />
      </div>

      <FormFooter
        error={error}
        pending={pending}
        onCancel={() => router.back()}
      />
    </form>
  );
}
