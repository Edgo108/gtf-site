"use client";

import { deleteGang } from "@/app/(app)/gangs/actions";
import { ActionButton } from "@/components/ui/ActionButton";

export function DeleteGangButton({ id }: { id: string }) {
  return (
    <ActionButton
      action={deleteGang}
      fields={{ id }}
      confirm="Déplacer cette fiche vers la corbeille ?"
      success="Fiche déplacée vers la corbeille"
      variant="danger"
    >
      Supprimer
    </ActionButton>
  );
}
