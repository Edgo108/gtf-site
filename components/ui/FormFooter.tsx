"use client";

import { Spinner } from "@/components/ui/Spinner";
import { btn } from "@/lib/ui/styles";

// Pied de formulaire commun : message d'erreur + boutons Enregistrer /
// Annuler, avec indicateur de chargement pendant l'envoi.
export function FormFooter({
  error,
  pending,
  onCancel,
  submitLabel = "Enregistrer",
}: {
  error: string | null;
  pending: boolean;
  onCancel: () => void;
  submitLabel?: string;
}) {
  return (
    <>
      {error && (
        <p role="alert" className="text-xs text-gtf-red">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className={btn("primary")}
        >
          {pending && <Spinner className="h-3 w-3" />}
          {submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className={btn("secondary")}
        >
          Annuler
        </button>
      </div>
    </>
  );
}
