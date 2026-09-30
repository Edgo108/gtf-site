"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { createClient } from "@/lib/supabase/client";
import {
  addOperationDrawing,
  deleteOperationDrawing,
  clearOperationDrawings,
} from "@/app/(app)/operations/actions";
import type { Gang } from "@/lib/supabase/gangs-types";
import type { SensitiveZone, ZonePoint } from "@/lib/supabase/zones-types";
import { labMarkerIconUrl, type LabMarker } from "@/lib/supabase/lab-markers-types";
import {
  DRAWING_DEFAULT_COLOR,
  DRAWING_DEFAULT_THICKNESS,
  type CercleDonnees,
  type LigneOuFlecheDonnees,
  type OperationDrawing,
  type OperationDrawingDonnees,
  type OperationDrawingType,
  type TexteDonnees,
  type TraitLibreDonnees,
} from "@/lib/supabase/operation-drawings-types";
import { Spinner } from "@/components/ui/Spinner";
import { useActionRunner } from "@/lib/ui/use-action-runner";
import { btn, fieldCompactClass } from "@/lib/ui/styles";
import { keepIfUnchanged } from "@/lib/ui/keep-if-unchanged";

// Mêmes 3 fonds de carte que la carte principale (/zones) — dupliqué
// volontairement plutôt que partagé, pour garder cette carte de
// planification totalement isolée du composant InteractiveMap (voir
// l'exigence d'isolation dans supabase/operation_drawings.sql).
const MAP_LAYERS = [
  { value: "atlas", label: "Atlas", url: "/map/atlas.webp" },
  { value: "satellite", label: "Satellite", url: "/map/satellite.webp" },
  { value: "road", label: "Routière", url: "/map/road.webp" },
] as const;
type MapLayerKey = (typeof MAP_LAYERS)[number]["value"];

type Tool = "vue" | "pinceau" | "ligne" | "fleche" | "cercle" | "texte";

const TOOLS: { value: Tool; label: string }[] = [
  { value: "vue", label: "Sélection" },
  { value: "pinceau", label: "Pinceau" },
  { value: "ligne", label: "Ligne" },
  { value: "fleche", label: "Flèche" },
  { value: "cercle", label: "Cercle" },
  { value: "texte", label: "Texte" },
];

const TOOL_HINTS: Record<Tool, string> = {
  vue: "Cliquez un élément dessiné pour le supprimer.",
  pinceau: "Maintenez le clic et déplacez la souris pour dessiner.",
  ligne: "Cliquez un point de départ, puis un point d'arrivée.",
  fleche: "Cliquez l'origine, puis la pointe de la flèche.",
  cercle: "Cliquez le centre, puis un point sur le bord.",
  texte: "Cliquez sur la carte pour placer le texte.",
};

const POLL_INTERVAL_MS = 15_000;

function pointsToLatLngs(points: ZonePoint[]): L.LatLngExpression[] {
  return points.map((p) => [p.y, p.x]);
}

function pointToLatLng(p: ZonePoint): L.LatLngExpression {
  return [p.y, p.x];
}

function latLngToPoint(latlng: L.LatLng): ZonePoint {
  return { x: latlng.lng, y: latlng.lat };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Icône labo statique (pas de mise à l'échelle par zoom) : simple repère
// de fond, non interactif, non cliquable depuis cette carte.
function makeStaticLabIcon(marker: LabMarker): L.Icon {
  return L.icon({
    iconUrl: labMarkerIconUrl(marker),
    iconSize: [28, 36],
    iconAnchor: [14, 34],
  });
}

// Triangle CSS pointant "vers le haut" par défaut, tourné pour pointer de
// `from` vers `to`. `angleDeg` = atan2(dx, dy) (dérivé pour un repère où
// +y (lat) correspond à "vers le haut" à l'écran, comme le reste de la
// carte en CRS.Simple).
function makeArrowIcon(angleDeg: number, color: string, size: number): L.DivIcon {
  const half = size / 2;
  return L.divIcon({
    className: "",
    html: `<div style="width:0;height:0;border-left:${half}px solid transparent;border-right:${half}px solid transparent;border-bottom:${size}px solid ${color};transform:rotate(${angleDeg}deg);transform-origin:50% 100%;"></div>`,
    iconSize: [size, size],
    iconAnchor: [half, size],
  });
}

export function PlanningMap({ operationId }: { operationId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const imageOverlayRef = useRef<L.ImageOverlay | null>(null);
  const refZonesLayerRef = useRef<L.LayerGroup | null>(null);
  const refLabsLayerRef = useRef<L.LayerGroup | null>(null);
  const drawingsLayerRef = useRef<L.LayerGroup | null>(null);
  const scratchLayerRef = useRef<L.LayerGroup | null>(null);

  const toolRef = useRef<Tool>("vue");
  const colorRef = useRef(DRAWING_DEFAULT_COLOR);
  const thicknessRef = useRef(DRAWING_DEFAULT_THICKNESS);
  const pendingStartRef = useRef<ZonePoint | null>(null);
  const isPaintingRef = useRef(false);
  const paintPointsRef = useRef<ZonePoint[]>([]);

  const [layer, setLayer] = useState<MapLayerKey>("atlas");
  const [gangs, setGangs] = useState<Gang[]>([]);
  const [zones, setZones] = useState<SensitiveZone[]>([]);
  const [labMarkers, setLabMarkers] = useState<LabMarker[]>([]);
  const [drawings, setDrawings] = useState<OperationDrawing[]>([]);

  const [mapReady, setMapReady] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [mapImageError, setMapImageError] = useState(false);
  const [layerLoading, setLayerLoading] = useState(false);

  const [tool, setTool] = useState<Tool>("vue");
  const [color, setColor] = useState(DRAWING_DEFAULT_COLOR);
  const [thickness, setThickness] = useState(DRAWING_DEFAULT_THICKNESS);
  const [pendingStart, setPendingStart] = useState<ZonePoint | null>(null);
  const [textDraftPoint, setTextDraftPoint] = useState<ZonePoint | null>(null);
  const [textDraftValue, setTextDraftValue] = useState("");
  const [toolError, setToolError] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  const run = useActionRunner();

  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);
  useEffect(() => {
    colorRef.current = color;
  }, [color]);
  useEffect(() => {
    thicknessRef.current = thickness;
  }, [thickness]);

  // Le pinceau capture le glisser-déposer de la souris : le déplacement de
  // la carte doit être désactivé pendant que cet outil est sélectionné,
  // sinon un cliquer-glisser panorame la carte au lieu de dessiner.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (tool === "pinceau") {
      map.dragging.disable();
    } else {
      map.dragging.enable();
    }
  }, [tool]);

  // --- Chargement des données (fond de référence + dessins) --------------

  async function fetchBackgroundData() {
    try {
      const supabase = createClient();
      const [gangsRes, zonesRes, labsRes] = await Promise.all([
        supabase.from("gangs").select("*").returns<Gang[]>(),
        supabase.from("sensitive_zones").select("*").returns<SensitiveZone[]>(),
        supabase.from("lab_markers").select("*").returns<LabMarker[]>(),
      ]);
      if (!gangsRes.error) setGangs(keepIfUnchanged(gangsRes.data ?? []));
      if (!zonesRes.error) setZones(keepIfUnchanged(zonesRes.data ?? []));
      if (!labsRes.error) setLabMarkers(keepIfUnchanged(labsRes.data ?? []));
      setDataLoaded(true);
    } catch {
      // Sondage périodique : une erreur ponctuelle réessaiera toute seule.
    }
  }

  async function fetchDrawings() {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("operation_drawings")
        .select("*")
        .eq("operation_id", operationId)
        .order("created_at", { ascending: true })
        .returns<OperationDrawing[]>();
      if (!error) setDrawings(keepIfUnchanged(data ?? []));
    } catch {
      // idem
    }
  }

  useEffect(() => {
    // Synchronisation avec le serveur (chargement initial + sondage
    // périodique, pour voir en direct les tracés des autres agents en
    // écriture) : cas d'usage explicitement prévu pour un effet.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchBackgroundData();
    fetchDrawings();
    // Pas de sondage quand l'onglet est en arrière-plan ; rattrapage
    // immédiat au retour sur l'onglet.
    const interval = setInterval(() => {
      if (document.hidden) return;
      fetchBackgroundData();
      fetchDrawings();
    }, POLL_INTERVAL_MS);
    function onVisibilityChange() {
      if (document.hidden) return;
      fetchBackgroundData();
      fetchDrawings();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
    // Exécuté une seule fois : `operationId` est fixe pour la durée de vie
    // de ce composant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Initialisation de la carte Leaflet ---------------------------------

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    const img = new Image();
    img.onerror = () => {
      if (!cancelled) setMapImageError(true);
    };
    img.onload = () => {
      if (cancelled) return;

      requestAnimationFrame(() => {
        if (cancelled || !containerRef.current || mapRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const bounds: L.LatLngBoundsExpression = [
          [0, 0],
          [img.naturalHeight, img.naturalWidth],
        ];

        const fitZoom = Math.floor(
          Math.log2(
            Math.min(
              rect.width / img.naturalWidth,
              rect.height / img.naturalHeight,
            ),
          ),
        );

        const map = L.map(containerRef.current, {
          crs: L.CRS.Simple,
          attributionControl: false,
          // Contrôle +/- géré manuellement ci-dessous (positionné en bas à
          // gauche) : par défaut en haut à gauche, il chevauchait la barre
          // d'outils de dessin (aussi en haut à gauche sur desktop).
          zoomControl: false,
          center: [img.naturalHeight / 2, img.naturalWidth / 2],
          zoom: fitZoom,
          minZoom: fitZoom,
          maxZoom: fitZoom + 4,
          maxBounds: bounds,
        });
        L.control.zoom({ position: "bottomleft" }).addTo(map);

        const overlay = L.imageOverlay(MAP_LAYERS[0].url, bounds).addTo(map);
        imageOverlayRef.current = overlay;
        overlay.on("load", () => setLayerLoading(false));

        refZonesLayerRef.current = L.layerGroup().addTo(map);
        refLabsLayerRef.current = L.layerGroup().addTo(map);
        drawingsLayerRef.current = L.layerGroup().addTo(map);
        scratchLayerRef.current = L.layerGroup().addTo(map);

        function updateScratchFreehand() {
          const group = scratchLayerRef.current;
          if (!group) return;
          group.clearLayers();
          if (paintPointsRef.current.length > 1) {
            L.polyline(pointsToLatLngs(paintPointsRef.current), {
              color: colorRef.current,
              weight: thicknessRef.current,
            }).addTo(group);
          }
        }

        map.on("click", (e: L.LeafletMouseEvent) => {
          const pt = latLngToPoint(e.latlng);
          const currentTool = toolRef.current;

          if (
            currentTool === "ligne" ||
            currentTool === "fleche" ||
            currentTool === "cercle"
          ) {
            if (!pendingStartRef.current) {
              pendingStartRef.current = pt;
              setPendingStart(pt);
            } else {
              const start = pendingStartRef.current;
              pendingStartRef.current = null;
              setPendingStart(null);
              scratchLayerRef.current?.clearLayers();

              if (currentTool === "cercle") {
                const radius = Math.hypot(pt.x - start.x, pt.y - start.y);
                saveDrawing("cercle", {
                  center: start,
                  radius,
                  couleur: colorRef.current,
                  epaisseur: thicknessRef.current,
                } satisfies CercleDonnees);
              } else {
                saveDrawing(currentTool, {
                  from: start,
                  to: pt,
                  couleur: colorRef.current,
                  epaisseur: thicknessRef.current,
                } satisfies LigneOuFlecheDonnees);
              }
            }
          } else if (currentTool === "texte") {
            setTextDraftPoint(pt);
            setTextDraftValue("");
          }
        });

        map.on("mousedown", (e: L.LeafletMouseEvent) => {
          if (toolRef.current !== "pinceau") return;
          isPaintingRef.current = true;
          paintPointsRef.current = [latLngToPoint(e.latlng)];
          updateScratchFreehand();
        });

        map.on("mousemove", (e: L.LeafletMouseEvent) => {
          if (!isPaintingRef.current) return;
          paintPointsRef.current.push(latLngToPoint(e.latlng));
          updateScratchFreehand();
        });

        map.on("mouseup", () => {
          if (!isPaintingRef.current) return;
          isPaintingRef.current = false;
          const points = paintPointsRef.current;
          paintPointsRef.current = [];
          scratchLayerRef.current?.clearLayers();
          if (points.length > 1) {
            saveDrawing("trait_libre", {
              points,
              couleur: colorRef.current,
              epaisseur: thicknessRef.current,
            } satisfies TraitLibreDonnees);
          }
        });

        mapRef.current = map;
        setMapReady(true);
      });
    };
    img.src = MAP_LAYERS[0].url;

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // Initialisation unique de Leaflet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Changement de fond de carte (conserve zoom/position) ---------------

  useEffect(() => {
    const selected = MAP_LAYERS.find((m) => m.value === layer);
    if (selected && imageOverlayRef.current) {
      imageOverlayRef.current.setUrl(selected.url);
    }
  }, [layer]);

  // --- Rendu du fond de référence : zones + labos (lecture seule) --------

  useEffect(() => {
    const group = refZonesLayerRef.current;
    if (!group) return;
    group.clearLayers();

    const gangsById = new Map(gangs.map((g) => [g.id, g]));
    for (const zone of zones) {
      const color = gangsById.get(zone.gang_id)?.couleur ?? "#8B94A0";
      L.polygon(pointsToLatLngs(zone.points), {
        color,
        weight: 1.5,
        fillColor: color,
        fillOpacity: 0.18,
        dashArray: zone.type_zone === "qg" ? "6,6" : undefined,
        interactive: false,
      }).addTo(group);
    }
  }, [zones, gangs]);

  useEffect(() => {
    const group = refLabsLayerRef.current;
    if (!group) return;
    group.clearLayers();

    for (const marker of labMarkers) {
      L.marker([marker.position.y, marker.position.x], {
        icon: makeStaticLabIcon(marker),
        interactive: false,
        opacity: 0.85,
      }).addTo(group);
    }
  }, [labMarkers]);

  // --- Aperçu du point de départ en attente (ligne / flèche / cercle) ----

  useEffect(() => {
    const group = scratchLayerRef.current;
    if (!group || tool === "pinceau") return;
    group.clearLayers();
    if (pendingStart) {
      L.circleMarker(pointToLatLng(pendingStart), {
        radius: 5,
        color,
        fillColor: color,
        fillOpacity: 1,
      }).addTo(group);
    }
  }, [pendingStart, tool, color]);

  // --- Rendu des éléments dessinés (persistés) ----------------------------

  useEffect(() => {
    const group = drawingsLayerRef.current;
    if (!group) return;
    group.clearLayers();

    for (const d of drawings) {
      const handleClick = () => {
        if (toolRef.current !== "vue") return;
        if (!window.confirm("Supprimer cet élément dessiné ?")) return;
        handleDeleteDrawing(d.id);
      };

      if (d.type_element === "trait_libre") {
        const donnees = d.donnees as TraitLibreDonnees;
        const pl = L.polyline(pointsToLatLngs(donnees.points), {
          color: donnees.couleur,
          weight: donnees.epaisseur,
        });
        pl.on("click", handleClick);
        pl.addTo(group);
      } else if (d.type_element === "ligne" || d.type_element === "fleche") {
        const donnees = d.donnees as LigneOuFlecheDonnees;
        const pl = L.polyline(
          [pointToLatLng(donnees.from), pointToLatLng(donnees.to)],
          { color: donnees.couleur, weight: donnees.epaisseur },
        );
        pl.on("click", handleClick);
        pl.addTo(group);

        if (d.type_element === "fleche") {
          const dx = donnees.to.x - donnees.from.x;
          const dy = donnees.to.y - donnees.from.y;
          const angleDeg = (Math.atan2(dx, dy) * 180) / Math.PI;
          const arrow = L.marker(pointToLatLng(donnees.to), {
            icon: makeArrowIcon(
              angleDeg,
              donnees.couleur,
              8 + donnees.epaisseur * 2,
            ),
          });
          arrow.on("click", handleClick);
          arrow.addTo(group);
        }
      } else if (d.type_element === "cercle") {
        const donnees = d.donnees as CercleDonnees;
        const c = L.circle(pointToLatLng(donnees.center), {
          radius: donnees.radius,
          color: donnees.couleur,
          weight: donnees.epaisseur,
          fillColor: donnees.couleur,
          fillOpacity: 0.08,
        });
        c.on("click", handleClick);
        c.addTo(group);
      } else if (d.type_element === "texte") {
        const donnees = d.donnees as TexteDonnees;
        const marker = L.marker(pointToLatLng(donnees.point), {
          icon: L.divIcon({
            className: "",
            html: `<div style="color:${donnees.couleur};font-weight:700;font-size:13px;white-space:nowrap;text-shadow:0 1px 2px #000,0 0 4px #000;">${escapeHtml(donnees.texte)}</div>`,
            iconSize: [0, 0],
            iconAnchor: [0, 0],
          }),
        });
        marker.on("click", handleClick);
        marker.addTo(group);
      }
    }
    // `handleDeleteDrawing` est redéfini à chaque rendu (closure sur
    // `operationId`/`run`, tous deux stables) : l'inclure redéclencherait
    // cet effet sans raison. Il est déjà relancé à chaque changement de
    // `drawings`, ce qui rebranche des gestionnaires de clic à jour.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawings]);

  // --- Actions : sauvegarde / suppression --------------------------------

  function selectTool(next: Tool) {
    setTool(next);
    setToolError(null);
    pendingStartRef.current = null;
    setPendingStart(null);
    setTextDraftPoint(null);
    scratchLayerRef.current?.clearLayers();
  }

  async function saveDrawing(
    type: OperationDrawingType,
    donnees: OperationDrawingDonnees,
  ) {
    setToolError(null);
    const formData = new FormData();
    formData.set("operation_id", operationId);
    formData.set("type_element", type);
    formData.set("donnees", JSON.stringify(donnees));

    const result = await run(() => addOperationDrawing(formData));
    if (result?.error) {
      setToolError(result.error);
      return;
    }
    fetchDrawings();
  }

  async function handleDeleteDrawing(id: string) {
    const formData = new FormData();
    formData.set("id", id);
    formData.set("operation_id", operationId);

    const result = await run(() => deleteOperationDrawing(formData));
    if (result?.error) {
      setToolError(result.error);
      return;
    }
    fetchDrawings();
  }

  async function submitText() {
    if (!textDraftPoint || !textDraftValue.trim()) return;
    await saveDrawing("texte", {
      point: textDraftPoint,
      texte: textDraftValue.trim(),
      couleur: colorRef.current,
    } satisfies TexteDonnees);
    setTextDraftPoint(null);
    setTextDraftValue("");
  }

  async function handleClearAll() {
    if (
      !window.confirm(
        "Tout effacer ? Cette action supprime tous les éléments dessinés sur cette carte de planification, pour tout le monde. Irréversible.",
      )
    ) {
      return;
    }
    setClearing(true);
    const formData = new FormData();
    formData.set("operation_id", operationId);
    const result = await run(() => clearOperationDrawings(formData));
    setClearing(false);
    if (result?.error) {
      setToolError(result.error);
      return;
    }
    fetchDrawings();
  }

  return (
    <div className="relative h-[70dvh] min-h-[24rem] w-full overflow-hidden rounded-md border border-gtf-border">
      <div ref={containerRef} className="h-full w-full bg-[#0A0C0F]" />

      {(!mapReady || !dataLoaded || mapImageError) && (
        <div
          role={mapImageError ? "alert" : "status"}
          className="absolute inset-0 z-[600] flex flex-col items-center justify-center gap-3 bg-gtf-bg/95 p-4 text-center text-sm text-gtf-text-muted"
        >
          {mapImageError ? (
            <>
              <p className="text-gtf-red">
                Impossible de charger le fond de carte.
              </p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className={btn("primary")}
              >
                Recharger la page
              </button>
            </>
          ) : (
            <>
              <Spinner className="h-6 w-6 text-gtf-blue-hover" />
              <p>Chargement de la carte de planification…</p>
            </>
          )}
        </div>
      )}

      {/* Haut à droite : fond de carte */}
      <div className="absolute right-3 top-3 z-[500] flex w-40 flex-col gap-2 sm:w-48">
        <select
          value={layer}
          onChange={(e) => {
            setLayerLoading(true);
            setLayer(e.target.value as MapLayerKey);
          }}
          className={`${fieldCompactClass} bg-gtf-panel/95 px-3 font-mono text-xs uppercase tracking-wider shadow-lg`}
        >
          {MAP_LAYERS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        {layerLoading && (
          <p className="flex items-center gap-2 rounded border border-gtf-border bg-gtf-panel/95 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-gtf-text-muted shadow-lg">
            <Spinner className="h-3 w-3 text-gtf-blue-hover" />
            Chargement du fond…
          </p>
        )}
        <p className="rounded border border-gtf-border bg-gtf-panel/95 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-gtf-text-muted shadow-lg">
          Zones/labos en fond : référence seule
        </p>
      </div>

      {/* Barre d'outils de dessin */}
      <div className="absolute inset-x-3 bottom-3 z-[500] sm:inset-x-auto sm:bottom-auto sm:left-3 sm:top-3">
        <div className="flex max-h-[60dvh] w-full flex-col gap-2 overflow-y-auto rounded-md border border-gtf-border bg-gtf-panel/95 p-3 shadow-lg sm:max-h-[calc(70dvh-1.5rem)] sm:w-64">
          <p className="font-display text-xs font-semibold uppercase tracking-wide text-gtf-text">
            Outils de dessin
          </p>

          <div className="grid grid-cols-3 gap-1.5">
            {TOOLS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => selectTool(t.value)}
                className={btn(
                  tool === t.value ? "primary" : "secondary",
                  "sm",
                  "font-mono",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <label
              htmlFor="drawing-color"
              className="font-mono text-[10px] uppercase tracking-wider text-gtf-text-muted"
            >
              Couleur
            </label>
            <input
              id="drawing-color"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-7 w-10 cursor-pointer rounded border border-gtf-border bg-transparent"
            />
            <label
              htmlFor="drawing-thickness"
              className="ml-1 font-mono text-[10px] uppercase tracking-wider text-gtf-text-muted"
            >
              Épaisseur
            </label>
            <input
              id="drawing-thickness"
              type="range"
              min={1}
              max={10}
              value={thickness}
              onChange={(e) => setThickness(Number(e.target.value))}
              className="flex-1"
            />
          </div>

          <p className="font-mono text-[11px] text-gtf-text-muted">
            {TOOL_HINTS[tool]}
          </p>

          {textDraftPoint && (
            <div className="flex gap-2">
              <input
                autoFocus
                type="text"
                value={textDraftValue}
                onChange={(e) => setTextDraftValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitText();
                }}
                placeholder="Texte à afficher…"
                className={`${fieldCompactClass} flex-1`}
              />
              <button
                type="button"
                onClick={submitText}
                className={btn("primary", "sm")}
              >
                Ajouter
              </button>
              <button
                type="button"
                onClick={() => setTextDraftPoint(null)}
                className={btn("secondary", "sm")}
              >
                ×
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handleClearAll}
            disabled={drawings.length === 0 || clearing}
            className={btn("danger", "sm")}
          >
            {clearing ? "..." : "Tout effacer"}
          </button>

          {toolError && (
            <p role="alert" className="text-xs text-gtf-red">
              {toolError}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
