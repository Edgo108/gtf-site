"use client";

import { toggleWantedStatut } from "@/app/(app)/mandats/actions";
import { ActionButton } from "@/components/ui/ActionButton";
import type { WantedStatut } from "@/lib/supabase/wanted-notices-types";

export function MarkCapturedButton({
  id,
  statut,
}: {
  id: string;
  statut: WantedStatut;
}) {
  const isActif = statut === "actif";

  return (
    <ActionButton
      action={toggleWantedStatut}
      fields={{ id, statut }}
      success={isActif ? "Suspect marqué comme capturé" : "Mandat réactivé"}
      variant={isActif ? "success" : "danger"}
    >
      {isActif ? "Marquer comme capturé" : "Marquer comme actif"}
    </ActionButton>
  );
}
