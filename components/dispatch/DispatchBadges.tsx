import { Car, Helicopter, Motorbike } from "lucide-react";
import {
  AGENT_STATUT_LABELS,
  CATEGORIE_PATROUILLE_LABELS,
  type AgentStatut,
  type CategoriePatrouille,
} from "@/lib/supabase/dispatch-types";
import { BADGE_TONES, badgeBase } from "@/lib/ui/styles";

const STATUT_TONES: Record<AgentStatut, keyof typeof BADGE_TONES> = {
  en_attente_dispatch: "muted",
  disponible: "green",
  occupe: "amber",
  en_intervention: "red",
};

export function AgentStatutBadge({ statut }: { statut: AgentStatut }) {
  return (
    <span className={`${badgeBase} ${BADGE_TONES[STATUT_TONES[statut]]}`}>
      {AGENT_STATUT_LABELS[statut]}
    </span>
  );
}

// Voiture / hélicoptère / moto pour Patrouille / Henry / Marry ; pas
// d'icône pour G.N.D, C.I.D et E.M.
export function CategorieIcon({
  categorie,
  className = "h-4 w-4",
}: {
  categorie: CategoriePatrouille | null;
  className?: string;
}) {
  const label = categorie ? CATEGORIE_PATROUILLE_LABELS[categorie] : "";
  switch (categorie) {
    case "patrouille":
      return <Car aria-label={label} className={className} />;
    case "henry":
      return <Helicopter aria-label={label} className={className} />;
    case "marry":
      return <Motorbike aria-label={label} className={className} />;
    default:
      return null;
  }
}
