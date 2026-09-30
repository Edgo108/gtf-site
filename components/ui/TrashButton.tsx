"use client";

import { ActionButton } from "@/components/ui/ActionButton";
import type { ButtonSize } from "@/lib/ui/styles";

// Bouton « Supprimer » d'une fiche : la déplace vers la corbeille de sa
// section (restauration ou suppression définitive par un admin ensuite).
// Unique pour toutes les sections : la page passe la Server Action.
export function TrashButton({
  action,
  id,
  what,
  success,
  size = "md",
}: {
  action: (formData: FormData) => Promise<{ error?: string } | void>;
  id: string;
  // Complément de la question, ex. « cette enquête », « ce mandat ».
  what: string;
  success: string;
  size?: ButtonSize;
}) {
  return (
    <ActionButton
      action={action}
      fields={{ id }}
      confirm={`Déplacer ${what} vers la corbeille ?`}
      success={success}
      variant="danger"
      size={size}
    >
      Supprimer
    </ActionButton>
  );
}
