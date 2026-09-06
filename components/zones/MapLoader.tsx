"use client";

import dynamic from "next/dynamic";

// Leaflet référence `window`/`navigator` au chargement du module : il doit
// être exclu du rendu serveur (ssr: false), ce qui n'est possible que
// depuis un Client Component — d'où ce petit wrapper dédié.
const InteractiveMap = dynamic(
  () => import("./InteractiveMap").then((m) => m.InteractiveMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[75vh] items-center justify-center rounded-md border border-gtf-border bg-gtf-panel text-sm text-gtf-text-muted">
        Chargement de la carte…
      </div>
    ),
  },
);

export function MapLoader({ currentUserId }: { currentUserId: string }) {
  return <InteractiveMap currentUserId={currentUserId} />;
}
