import { BADGE_TONES, badgeBase } from "@/lib/ui/styles";
import type { Profile } from "@/lib/supabase/types";

// Statut d'un compte agent (actif / suspendu) : même pastille que tous les
// autres statuts du site.
export function AgentStatutBadge({ statut }: { statut: Profile["statut"] }) {
  const isActif = statut === "actif";
  return (
    <span
      className={`${badgeBase} ${isActif ? BADGE_TONES.green : BADGE_TONES.red}`}
    >
      {statut}
    </span>
  );
}
