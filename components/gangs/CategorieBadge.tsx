import {
  GANG_CATEGORIE_LABELS,
  type GangCategorie,
} from "@/lib/supabase/gangs-types";

const STYLES: Record<GangCategorie, string> = {
  Gang: "border-gtf-blue text-gtf-blue-hover bg-gtf-blue/10",
  MC: "border-gtf-amber text-gtf-amber bg-gtf-amber/10",
  Orga: "border-gtf-green text-gtf-green bg-gtf-green/10",
};

export function CategorieBadge({ categorie }: { categorie: GangCategorie }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded border px-2 py-0.5 font-mono text-xs uppercase tracking-wider ${
        STYLES[categorie] ?? STYLES.Gang
      }`}
    >
      {GANG_CATEGORIE_LABELS[categorie] ?? categorie}
    </span>
  );
}
