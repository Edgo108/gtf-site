"use client";

import { deletePatchNote } from "@/app/(app)/patch-notes/actions";
import { ActionButton } from "@/components/ui/ActionButton";

export function DeletePatchNoteButton({
  id,
  titre,
}: {
  id: string;
  titre: string;
}) {
  return (
    <ActionButton
      action={deletePatchNote}
      fields={{ id }}
      confirm={`Supprimer définitivement l'entrée « ${titre} » ? Cette action est irréversible.`}
      success="Entrée de patch note supprimée"
      variant="danger"
      size="sm"
    >
      Supprimer
    </ActionButton>
  );
}
