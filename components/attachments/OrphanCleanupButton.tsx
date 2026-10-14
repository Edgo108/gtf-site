"use client";

import { useTransition } from "react";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/ToastProvider";
import { useActionRunner } from "@/lib/ui/use-action-runner";
import { cleanupOrphanAttachments } from "@/lib/actions/attachments";
import { btn } from "@/lib/ui/styles";

// Nettoyage manuel (admin) des pièces jointes sans fiche enregistrée
// depuis plus de 24 h : créations abandonnées sans « Annuler », envois
// interrompus…
export function OrphanCleanupButton() {
  const [pending, startTransition] = useTransition();
  const run = useActionRunner();
  const toast = useToast();

  function handleClick() {
    if (
      !window.confirm(
        "Supprimer les pièces jointes rattachées à aucune fiche depuis plus de 24 h ?",
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await run(() => cleanupOrphanAttachments());
      if (result.error || !("removed" in result)) return;
      toast.success(
        result.removed === 0
          ? "Aucun fichier orphelin"
          : `${result.removed} fichier(s) orphelin(s) supprimé(s)`,
      );
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-busy={pending}
      className={btn("secondary", "sm")}
    >
      {pending && <Spinner className="h-3 w-3" />}
      Nettoyer les pièces jointes orphelines
    </button>
  );
}
