import { badgeBase, BADGE_TONES } from "@/lib/ui/styles";
import {
  OPERATION_STATUT_LABELS,
  type OperationStatut,
} from "@/lib/supabase/operations-types";

const TONES: Record<OperationStatut, string> = {
  en_cours: BADGE_TONES.blue,
  cloturee: BADGE_TONES.green,
  archivee: BADGE_TONES.muted,
};

export function OperationStatutBadge({ statut }: { statut: OperationStatut }) {
  return (
    <span className={`${badgeBase} ${TONES[statut]}`}>
      {OPERATION_STATUT_LABELS[statut]}
    </span>
  );
}
