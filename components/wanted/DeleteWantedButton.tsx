"use client";

import { deleteWantedNotice } from "@/app/(app)/mandats/actions";
import { ActionButton } from "@/components/ui/ActionButton";

export function DeleteWantedButton({ id }: { id: string }) {
  return (
    <ActionButton
      action={deleteWantedNotice}
      fields={{ id }}
      confirm="Supprimer définitivement ce mandat de recherche ?"
      success="Mandat supprimé"
      variant="danger"
    >
      Supprimer
    </ActionButton>
  );
}
