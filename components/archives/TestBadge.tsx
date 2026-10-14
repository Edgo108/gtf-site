import { BADGE_TONES, badgeBase } from "@/lib/ui/styles";

// Pastille « TEST » des rapports / plaintes d'entraînement.
export function TestBadge({ className = "" }: { className?: string }) {
  return (
    <span
      title="Document d'entraînement : sans numéro officiel, non comptabilisé"
      className={`${badgeBase} ${BADGE_TONES.violet} font-semibold ${className}`}
    >
      Test
    </span>
  );
}
