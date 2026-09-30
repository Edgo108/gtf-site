"use client";

import {
  softDeletePlainte,
  softDeleteRapport,
} from "@/app/(app)/archives/actions";
import { ActionButton } from "@/components/ui/ActionButton";

export function DeleteRapportButton({ id }: { id: string }) {
  return (
    <ActionButton
      action={softDeleteRapport}
      fields={{ id }}
      confirm="Déplacer ce rapport vers la corbeille ?"
      success="Rapport déplacé vers la corbeille"
      variant="danger"
    >
      Supprimer
    </ActionButton>
  );
}

export function DeletePlainteButton({ id }: { id: string }) {
  return (
    <ActionButton
      action={softDeletePlainte}
      fields={{ id }}
      confirm="Déplacer cette plainte vers la corbeille ?"
      success="Plainte déplacée vers la corbeille"
      variant="danger"
    >
      Supprimer
    </ActionButton>
  );
}
