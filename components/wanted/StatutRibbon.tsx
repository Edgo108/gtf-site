import type { WantedStatut } from "@/lib/supabase/wanted-notices-types";

export function StatutRibbon({ statut }: { statut: WantedStatut }) {
  const isActif = statut === "actif";

  return (
    <div
      className={`pointer-events-none absolute -left-9 top-4 w-36 -rotate-45 py-1 text-center font-display text-[10px] font-bold uppercase tracking-widest text-gtf-text shadow-md ${
        isActif ? "bg-gtf-red" : "bg-gtf-green"
      }`}
    >
      {isActif ? "Recherché" : "Capturé"}
    </div>
  );
}
