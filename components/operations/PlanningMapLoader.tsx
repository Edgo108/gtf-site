"use client";

import dynamic from "next/dynamic";

// Leaflet référence `window`/`navigator` au chargement du module : il doit
// être exclu du rendu serveur (ssr: false), ce qui n'est possible que
// depuis un Client Component — d'où ce petit wrapper dédié (calqué sur
// components/zones/MapLoader.tsx).
const PlanningMap = dynamic(
  () => import("./PlanningMap").then((m) => m.PlanningMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[70vh] items-center justify-center rounded-md border border-gtf-border bg-gtf-panel text-sm text-gtf-text-muted">
        Chargement de la carte de planification…
      </div>
    ),
  },
);

export function PlanningMapLoader({ operationId }: { operationId: string }) {
  return <PlanningMap operationId={operationId} />;
}
