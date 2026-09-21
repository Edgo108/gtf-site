"use client";

import { softDeleteInvestigation } from "@/app/(app)/enquetes/actions";
import { ActionButton } from "@/components/ui/ActionButton";

export function DeleteInvestigationButton({ id }: { id: string }) {
  return (
    <ActionButton
      action={softDeleteInvestigation}
      fields={{ id }}
      confirm="Déplacer cette enquête vers la corbeille ?"
      success="Enquête déplacée vers la corbeille"
      variant="danger"
    >
      Supprimer
    </ActionButton>
  );
}
