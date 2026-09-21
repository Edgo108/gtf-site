"use client";

import { ActionButton } from "@/components/ui/ActionButton";

type Action = (formData: FormData) => Promise<{ error?: string } | void>;

// Boutons « Restaurer » / « Supprimer définitivement » d'une ligne de
// corbeille (enquêtes, B.D.D, zones, labos) : même comportement partout.
export function TrashActions({
  id,
  restore,
  destroy,
  restoreSuccess,
  destroySuccess,
  destroyConfirm,
}: {
  id: string;
  restore: Action;
  destroy: Action;
  restoreSuccess: string;
  destroySuccess: string;
  destroyConfirm: string;
}) {
  return (
    <div className="gtf-stack-actions flex flex-wrap justify-end gap-2">
      <ActionButton
        action={restore}
        fields={{ id }}
        success={restoreSuccess}
        variant="success"
        size="sm"
      >
        Restaurer
      </ActionButton>
      <ActionButton
        action={destroy}
        fields={{ id }}
        confirm={destroyConfirm}
        success={destroySuccess}
        variant="danger"
        size="sm"
      >
        Supprimer définitivement
      </ActionButton>
    </div>
  );
}
